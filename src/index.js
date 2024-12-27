#!/usr/bin/env node

import fs from "fs";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fg from "fast-glob";
import { Linter } from "./Linter.js";
import logger from "./logger.js";
import prepareTestFile from "./prepareTestFile.js";

yargs(hideBin(process.argv))
  .command(
    "reset-test",
    "テストファイルを初期状態にリセットします",
    (yargs) => {
      return yargs
        .option("file", {
          alias: "f",
          type: "string",
          description: "リセットするファイルを指定します",
          default: "src/testFile.js",
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          description: "詳細なログを表示します",
          default: false,
        });
    },
    async (argv) => {
      logger.info("🛠️ reset-test コマンドが呼び出されました！");
      try {
        const fileToReset = argv.file;
        logger.info(`リセットするファイル: ${fileToReset}`);
        await prepareTestFile(fileToReset);
        logger.info("✅ テストファイルがリセットされました。");
      } catch (error) {
        logger.error("❌ テストファイルのリセットに失敗しました。");
        logger.error(error.message);
      }
    }
  )
  .command(
    "*",
    "指定したオプションでリンターを実行します",
    (yargs) => {
      return yargs
        .option("fix", {
          alias: "f",
          type: "boolean",
          description: "検出された問題を自動修正します",
        })
        .option("check", {
          alias: "c",
          type: "boolean",
          description: "問題を修正せずに検出のみを行います",
        })
        .option("no-sound", {
          type: "boolean",
          description: "音声通知を無効化します",
          default: false,
        })
        .option("files", {
          type: "string",
          description: "対象のファイルやディレクトリを指定します",
          default: "src/**/*.js", // デフォルト値
        })
        .option("verbose", {
          alias: "v",
          type: "boolean",
          description: "詳細なログを表示します",
          default: false,
        });
    },
    async (argv) => {
      try {
        const filesPattern = argv.files || "src/**/*.js";
        if (filesPattern === "src/**/*.js") {
          const resolvedPath = path.resolve(process.cwd(), "src");
          if (!fs.existsSync(resolvedPath)) {
            logger.warn("⚠️'src/' ディレクトリが見つかりません。");
            logger.info("🛠️ 自動的に初期化を行います...");
            await prepareTestFile("src/testFile.js");
            logger.info("✅ `src` ディレクトリが初期化されました。");
          }
        }

        const matchedFiles = await fg(filesPattern);
        if (!matchedFiles.length) {
          logger.warn(
            `⚠️ ファイルが見つかりません: ${filesPattern}。--files オプションで対象を指定してください。`
          );
          process.exit(1);
        }
        logger.info(`🔍 ファイルパターン: ${filesPattern}`);
        const linter = new Linter({
          soundEnabled: argv["no-sound"] ? false : true,
          targetFiles: filesPattern,
          mode: argv.fix ? "fix" : argv.check ? "check" : "default",
          verbose: argv.verbose,
        });
        await linter.lintAndFix();
      } catch (error) {
        logger.error("❌ エラーが発生しました:");
        logger.error(error.stack);
      }
    }
  )
  .help()
  .alias("help", "h")
  .epilogue("詳細については、README を参照してください。")
  .parse();
