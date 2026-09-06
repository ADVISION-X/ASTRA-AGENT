import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ROOT, sha } from "../governance-runtime.js";

export const copyTargets = (paths: readonly string[], runDirectory: string, domain: string): string => {
  const root = mkdtempSync(resolve(runDirectory, `${domain}-sealed-`));
  for (const path of paths) {
    const destination = resolve(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(ROOT, path), destination);
  }
  return root;
};

export const sealedSnapshotDigest = (root: string, paths: readonly string[]): string => sha(paths
  .map((path) => `${path}\0${sha(readFileSync(resolve(root, path)))}`).join("\0"));
