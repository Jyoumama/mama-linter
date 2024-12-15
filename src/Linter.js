import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fg from "fast-glob";
import chalk from "chalk";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import { playSound } from "./playSound.js";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Linter {
  constructor(argv) {
    this.soundEnabled = !argv.noSound;
    this.targetFiles = argv.files;
    this.mode = argv.mode;
    this.verbose = argv.verbose;
  }

  async runPrettier(file) {
    const fileContent = await fs.readFile(file, "utf8");
    const options = await prettier.resolveConfig(file);
    const formatted = await prettier.format(fileContent, {
      ...options,
      filepath: file,
    });

    if (fileContent !== formatted) {
      await fs.writeFile(file, formatted, "utf8");
      logger.info(
        chalk.green(`✅ Prettier による修正が適用されました: ${file}`)
      );
      if (this.soundEnabled) {
        playSound(path.resolve(__dirname, "../assets/prettier-fix.mp3"));
      }
      return true;
    }

    return false;
  }

  async runEslint(file, fix = true) {
    const eslint = new ESLint({ fix });
    const results = await eslint.lintFiles([file]);

    let hasManualFixes = false;

    for (const result of results) {
      if (result.output && fix) {
        await fs.writeFile(result.filePath, result.output, "utf8");
        logger.info(
          chalk.green(`✅ ESLint による修正が適用されました: ${file}`)
        );
        if (this.soundEnabled) {
          playSound(path.resolve(__dirname, "../assets/eslint-fix.mp3"));
        }
      }

      if (result.messages.length > 0) {
        hasManualFixes = true;
        logger.info(chalk.yellow(`⚠️ 修正が必要な箇所が残っています: ${file}`));
        result.messages.forEach((message) => {
          let specificMessage = "";

          switch (message.ruleId) {
            case "no-undef":
              specificMessage = "未定義の変数を確認してください";
              break;
            case "no-unused-vars":
              specificMessage = "未使用の変数を削除してください";
              break;
            case "no-console":
              specificMessage = "console.log を削除または置き換えてください";
              break;
            default:
              specificMessage = message.message;
          }

          logger.info(
            chalk.yellow(
              `- ${message.line}:${message.column} ${specificMessage} (${message.ruleId})`
            )
          );
        });

        if (this.soundEnabled) {
          playSound(path.resolve(__dirname, "../assets/attention.mp3"));
        }
      }
    }

    return hasManualFixes;
  }

  async lintAndFix() {
    const files = await fg([this.targetFiles], { absolute: true });
    let manualFixRequired = false;

    for (const file of files) {
      const originalContent = await fs.readFile(file, "utf8");
      let prettierChanged = false;

      try {
        if (this.mode === "check") {
          logger.info(chalk.blue(`🔍 チェック中: ${file}`));
          if (this.verbose) {
            logger.info(chalk.blue(`詳細ログ: ${file} をチェックしています。`));
          }
          await this.runEslint(file, false);
        } else {
          logger.info(
            chalk.blue(
              this.mode === "fix"
                ? `🔧 修正中: ${file}`
                : `🛠️ 修正および手動修正箇所をリストアップ中: ${file}`
            )
          );
          if (this.verbose) {
            logger.info(chalk.blue(`詳細ログ: ${file} を処理中。`));
          }
          prettierChanged = await this.runPrettier(file);
          const manualFixes = await this.runEslint(file, this.mode === "fix");
          manualFixRequired = manualFixRequired || manualFixes;
        }
      } catch (error) {
        logger.error(chalk.red(`❌ エラーが発生しました: ${file}`));
        logger.error(chalk.red(error.message));
      }

      const updatedContent = await fs.readFile(file, "utf8");

      if (
        !manualFixRequired &&
        originalContent === updatedContent &&
        !prettierChanged
      ) {
        logger.info(chalk.green(`✅ 修正の必要がありませんでした: ${file}`));
      }
    }

    if (!manualFixRequired) {
      logger.info(chalk.green("🎉 手動修正が完了しました！"));
      if (this.soundEnabled) {
        playSound(path.resolve(__dirname, "../assets/fix-applied.mp3"));
      }
    }
  }
}

const argv = yargs(hideBin(process.argv))
  .usage("Usage: $0 [options]")
  .options({
    noSound: {
      type: "boolean",
      describe: "音声通知を無効化",
    },
    files: {
      type: "string",
      describe: '対象ファイルやディレクトリを指定\n(デフォルト: "src/**/*.js")',
      default: "src/**/*.js",
    },
    mode: {
      type: "string",
      describe:
        "実行モード ('default', 'fix', 'check')\n(選択可能: \"default\", \"fix\", \"check\")",
      choices: ["default", "fix", "check"],
      default: "default",
    },
    verbose: {
      type: "boolean",
      describe: "詳細なログを表示",
    },
  })
  .help()
  .alias("help", "h")
  .epilogue("詳細については、README.mdを参照してください。").argv;

const linter = new Linter(argv);
linter.lintAndFix();

export { Linter };
