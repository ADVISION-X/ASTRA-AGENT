import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([".git", "dist", "node_modules"]);

export const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const ensureDirectory = async (dirPath: string): Promise<void> => {
  await mkdir(dirPath, { recursive: true });
};

export const readTextFile = async (filePath: string): Promise<string> => readFile(filePath, "utf8");

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const text = await readTextFile(filePath);
  return JSON.parse(text) as T;
};

export const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const writeTextFile = async (filePath: string, value: string): Promise<void> => {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
};

export const listImmediateFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name));
};

export const listImmediateDirectories = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dirPath, entry.name));
};

export const listFilesRecursive = async (
  dirPath: string,
  options?: {
    extensions?: string[];
    ignoreDirs?: string[];
  },
): Promise<string[]> => {
  const ignoreDirs = new Set(options?.ignoreDirs ?? []);
  const results: string[] = [];

  const visit = async (currentPath: string): Promise<void> => {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name) || ignoreDirs.has(entry.name)) {
          continue;
        }
        await visit(entryPath);
        continue;
      }

      if (options?.extensions && !options.extensions.some((extension) => entry.name.endsWith(extension))) {
        continue;
      }

      results.push(entryPath);
    }
  };

  if (await fileExists(dirPath)) {
    await visit(dirPath);
  }

  return results;
};