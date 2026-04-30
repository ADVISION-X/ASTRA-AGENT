import path from "node:path";

import { repoRoot } from "./path-roots.js";

export const pathFromRepoRoot = (relativePath: string): string =>
  path.join(repoRoot, ...relativePath.split("/"));

export const toRepoRelativePath = (absolutePath: string): string =>
  path.relative(repoRoot, absolutePath).split(path.sep).join("/");
