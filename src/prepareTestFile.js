import fs from "fs/promises";
import path from "path";
import logger from "./logger.js";

export default async function prepareTestFile(fileToReset) {
  try {
    // パッケージ内の `src` ディレクトリにファイルを作成
    const resolvedFilePath = path.resolve(process.cwd(), fileToReset);

    // ディレクトリが存在しない場合に作成
    await fs.mkdir(path.dirname(resolvedFilePath), { recursive: true });

    const testFileContent = `
// ESLint と Prettier の自動修正と手動修正をデモするためのファイル

var noUsedVar = 'Hello';

function unusedFunction() {
  const unusedVariable = "This is unused";
}

noUsedVar = 'Updated value';
`;

    await fs.writeFile(resolvedFilePath, testFileContent, "utf8");
    logger.info(`✅ ファイルがリセットされました: ${resolvedFilePath}`);
  } catch (error) {
    logger.error("❌ テストファイルのリセット中にエラーが発生しました:");
    logger.error(error.message);
  }
}
