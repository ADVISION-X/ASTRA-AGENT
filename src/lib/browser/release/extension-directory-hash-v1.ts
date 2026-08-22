import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export type ExtensionDirectoryHashV1 = `sha256:${string}`;

const sha256 = (value: string | Buffer): ExtensionDirectoryHashV1 =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

type DirectoryEntry = Readonly<{ path: string; sha256: ExtensionDirectoryHashV1 }>;

const readEntries = async (root: string, current = root): Promise<readonly DirectoryEntry[]> => {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => entry.name !== ".DS_Store" && entry.name !== "extension-build-manifest.json")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry): Promise<readonly DirectoryEntry[]> => {
      const path = join(current, entry.name);
      if (entry.isDirectory()) return readEntries(root, path);
      if (!entry.isFile()) throw new Error("BROWSER_UNPACKED_ARTIFACT_INVALID");
      return [{ path: relative(root, path), sha256: sha256(await readFile(path)) }];
    }));
  return nested.flat();
};

/** Hashes the exact unpacked artifact tree; the release record intentionally lives elsewhere. */
export const hashExtensionDirectoryV1 = async (directory: string): Promise<ExtensionDirectoryHashV1> => {
  const root = resolve(directory);
  const entries = await readEntries(root);
  return sha256(JSON.stringify(entries));
};
