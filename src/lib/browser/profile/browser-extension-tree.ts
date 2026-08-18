import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const collectStableFiles = (root: string, current = root): string[] => {
  const result: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.name === "_metadata" || entry.name.startsWith(".")) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`BROWSER_EXTENSION_TREE_SYMLINK_FORBIDDEN:${absolute}`);
    }
    if (entry.isDirectory()) result.push(...collectStableFiles(root, absolute));
    else if (entry.isFile()) result.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return result.sort((left, right) => left.localeCompare(right));
};

export const hashBrowserExtensionTree = (extensionRoot: string): string => {
  const files = collectStableFiles(extensionRoot);
  if (files.length === 0) throw new Error("BROWSER_EXTENSION_TREE_EMPTY");
  const digest = createHash("sha256");
  for (const relative of files) {
    const absolute = path.join(extensionRoot, ...relative.split("/"));
    const stat = statSync(absolute);
    if (!stat.isFile()) throw new Error(`BROWSER_EXTENSION_TREE_NON_FILE:${relative}`);
    digest.update(relative, "utf8");
    digest.update("\0", "utf8");
    digest.update(readFileSync(absolute));
    digest.update("\0", "utf8");
  }
  return `sha256:${digest.digest("hex")}`;
};

export const verifyInstalledBrowserExtensionTree = (input: Readonly<{
  userDataDir: string;
  profileDirectory: string;
  extensionId: string;
  extensionVersion: string;
  expectedTreeSha256: string;
}>): Readonly<{ extensionInstallDir: string; treeSha256: string }> => {
  if (!HASH_PATTERN.test(input.expectedTreeSha256)) {
    throw new Error("BROWSER_EXTENSION_EXPECTED_TREE_HASH_INVALID");
  }
  const extensionIdRoot = path.join(
    input.userDataDir,
    input.profileDirectory,
    "Extensions",
    input.extensionId,
  );
  let candidates: string[];
  try {
    candidates = readdirSync(extensionIdRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(extensionIdRoot, entry.name));
  } catch {
    throw new Error(`BROWSER_EXTENSION_INSTALLATION_MISSING:${extensionIdRoot}`);
  }

  const matching = candidates.filter((candidate) => {
    try {
      const manifest = JSON.parse(readFileSync(path.join(candidate, "manifest.json"), "utf8")) as {
        version?: unknown;
      };
      return manifest.version === input.extensionVersion;
    } catch {
      return false;
    }
  });
  if (matching.length !== 1) {
    throw new Error(`BROWSER_EXTENSION_VERSION_INSTALLATION_AMBIGUOUS:${input.extensionVersion}:${matching.length}`);
  }
  const extensionInstallDir = matching[0]!;
  const treeSha256 = hashBrowserExtensionTree(extensionInstallDir);
  if (treeSha256 !== input.expectedTreeSha256) {
    throw new Error(`BROWSER_EXTENSION_TREE_HASH_MISMATCH:${treeSha256}`);
  }
  return Object.freeze({ extensionInstallDir, treeSha256 });
};
