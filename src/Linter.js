import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import fg from "fast-glob";
import chalk from "chalk";
import { ESLint } from "eslint";
import * as prettier from "prettier";
import { playSound } from "./playSound.js";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Linter {
  constructor({ soundEnabled, targetFiles, mode, verbose }) {
    this.soundEnabled = soundEnabled;
    this.targetFiles = targetFiles;
    this.mode = mode;
    this.verbose = verbose;
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
          const specificMessage = message.message;
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
    const files = await fg([path.resolve(process.cwd(), this.targetFiles)], {
      absolute: true,
    });
    if (!files.length) {
      logger.error(
        chalk.red(`❌ ファイルが見つかりません: ${this.targetFiles}`)
      );
      throw new Error(
        "指定されたパターンに一致するファイルが見つかりませんでした。"
      );
    }
    let manualFixRequired = false;
    let soundPlayed = false;

    for (const file of files) {
      const originalContent = await fs.readFile(file, "utf8");
      let prettierChanged = false;

      try {
        if (this.mode === "check") {
          logger.info(chalk.blue(`🔍 チェック中: ${file}`));
          const manualFixes = await this.runEslint(file, false);
          manualFixRequired = manualFixRequired || manualFixes;
        } else {
          logger.info(
            chalk.blue(`🛠️ 修正および手動修正箇所をリストアップ中: ${file}`)
          );
          prettierChanged = await this.runPrettier(file);
          const manualFixes = await this.runEslint(file, this.mode === "fix");

          if ((prettierChanged || manualFixes) && !soundPlayed) {
            if (this.soundEnabled) {
              playSound(path.resolve(__dirname, "../assets/attention.mp3"));
              soundPlayed = true;
            }
          }
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

export { Linter };
