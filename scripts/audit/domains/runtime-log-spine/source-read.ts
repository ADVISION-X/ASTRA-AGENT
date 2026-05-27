import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(currentDir, "../../../..");

export type RuntimeSourceFile = {
  path: string;
  absolutePath: string;
  text: string;
};

export const toRepoPath = (absolutePath: string): string => relative(repoRoot, absolutePath).split("\\").join("/");

export const readRepoFile = (repoPath: string): RuntimeSourceFile | null => {
  const absolutePath = resolve(repoRoot, repoPath);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return {
    path: repoPath,
    absolutePath,
    text: readFileSync(absolutePath, "utf8"),
  };
};

const lineOfIndex = (text: string, index: number): number => text.slice(0, Math.max(0, index)).split("\n").length;

export const findLine = (text: string, pattern: string | readonly string[]): number => {
  const tokens = typeof pattern === "string" ? [pattern] : pattern;
  const index = tokens
    .map((token) => text.indexOf(token))
    .filter((tokenIndex) => tokenIndex >= 0)
    .sort((left, right) => left - right)[0] ?? -1;
  return index >= 0 ? lineOfIndex(text, index) : 1;
};
