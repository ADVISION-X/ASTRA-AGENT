import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([".git", ".venv", "dist", "node_modules"]);
const recursiveFileListCache = new Map<string, Promise<string[]>>();
let tempFileSequence = 0;

const isMissingPathError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const fileExists = async (targetPath: string): Promise<boolean> => {
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

const readTextFile = async (filePath: string): Promise<string> => readFile(filePath, "utf8");

const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const text = await readTextFile(filePath);
  return JSON.parse(text) as T;
};

const writeJsonFile = async (filePath: string, value: unknown): Promise<void> => {
  await writeTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const writeTextFile = async (filePath: string, value: string): Promise<void> => {
  await ensureDirectory(path.dirname(filePath));
  tempFileSequence += 1;
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${tempFileSequence}.tmp`;
  await writeFile(tempPath, value, "utf8");
  await rename(tempPath, filePath);
};

const listImmediateFiles = async (dirPath: string): Promise<string[]> => {
  const entries = await readdir(dirPath, { withFileTypes: true, encoding: "utf8" });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name));
};

const listImmediateDirectories = async (dirPath: string): Promise<string[]> => {
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

const createRecursiveFileListCacheKey = (
  dirPath: string,
  options?: {
    extensions?: string[];
    ignoreDirs?: string[];
  },
): string =>
  JSON.stringify({
    dirPath: path.resolve(dirPath),
    extensions: [...(options?.extensions ?? [])].sort(),
    ignoreDirs: [...(options?.ignoreDirs ?? [])].sort(),
  });

const listFilesRecursive = async (
  dirPath: string,
  options?: {
    extensions?: string[];
    ignoreDirs?: string[];
  },
): Promise<string[]> => {
  const cacheKey = createRecursiveFileListCacheKey(dirPath, options);
  const cached = recursiveFileListCache.get(cacheKey);
  if (cached) {
    return [...(await cached)];
  }

  const state: RecursiveCollectionState = {
    ignoreDirs: new Set(options?.ignoreDirs ?? []),
    extensions: options?.extensions,
    results: [],
  };

  const collected = (async () => {
    if (await fileExists(dirPath)) {
      await collectRecursiveFiles(dirPath, state);
    }

    return state.results.sort((left, right) => left.localeCompare(right));
  })();

  recursiveFileListCache.set(cacheKey, collected);
  try {
    return [...(await collected)];
  } catch (error) {
    recursiveFileListCache.delete(cacheKey);
    throw error;
  }
};
