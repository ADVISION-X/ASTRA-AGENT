import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function readJsonFile(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

export async function writeJsonFile(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export async function writeTextFile(filePath, content) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
  return filePath;
}