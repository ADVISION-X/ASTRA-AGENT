import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([".git", ".venv", "dist", "node_modules"]);

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }

    throw error;
  }
};

const ensureDirectory = async (dirPath: string): Promise<void> => {
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
  const entries = await readdir(dirPath, { withFileTypes: true, encoding: "utf8" });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name));
};

export const listImmediateDirectories = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true, encoding: "utf8" });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dirPath, entry.name));
};

const shouldIgnoreDirectory = (entryName: string, ignoreDirs: Set<string>): boolean =>
  DEFAULT_IGNORED_DIRS.has(entryName) || ignoreDirs.has(entryName);

const shouldIncludeFile = (entryName: string, extensions?: string[]): boolean =>
  !extensions || extensions.some((extension) => entryName.endsWith(extension));

type RecursiveCollectionState = {
  ignoreDirs: Set<string>;
  extensions: string[] | undefined;
  results: string[];
};

const collectRecursiveDirectory = async (
  entryPath: string,
  entryName: string,
  state: RecursiveCollectionState,
): Promise<void> => {
  if (shouldIgnoreDirectory(entryName, state.ignoreDirs)) {
    return;
  }

  await collectRecursiveFiles(entryPath, state);
};

const collectRecursiveFile = (
  entryPath: string,
  entryName: string,
  state: RecursiveCollectionState,
): void => {
  if (shouldIncludeFile(entryName, state.extensions)) {
    state.results.push(entryPath);
  }
};

const collectRecursiveEntry = async (
  currentPath: string,
  entry: import("node:fs").Dirent<string>,
  state: RecursiveCollectionState,
): Promise<void> => {
  const entryPath = path.join(currentPath, entry.name);
  if (entry.isDirectory()) {
    await collectRecursiveDirectory(entryPath, entry.name, state);
    return;
  }

  collectRecursiveFile(entryPath, entry.name, state);
};

const collectRecursiveFiles = async (
  currentPath: string,
  state: RecursiveCollectionState,
): Promise<void> => {
  const entries = await readdir(currentPath, { withFileTypes: true, encoding: "utf8" });
  for (const entry of entries) {
    await collectRecursiveEntry(currentPath, entry, state);
  }
};

export const listFilesRecursive = async (
  dirPath: string,
  options?: {
    extensions?: string[];
    ignoreDirs?: string[];
  },
): Promise<string[]> => {
  const state: RecursiveCollectionState = {
    ignoreDirs: new Set(options?.ignoreDirs ?? []),
    extensions: options?.extensions,
    results: [],
  };

  if (await fileExists(dirPath)) {
    await collectRecursiveFiles(dirPath, state);
  }

  return state.results;
};