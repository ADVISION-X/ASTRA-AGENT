import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";

const currentFile = fileURLToPath(import.meta.url);

export const repoRoot = resolve(currentFile, "../../../..");

export const toRepoPath = (absolutePath: string): string =>
  relative(repoRoot, absolutePath).split("\\").join("/");

export const resolveFromRepo = (...segments: readonly string[]): string =>
  resolve(repoRoot, ...segments);
