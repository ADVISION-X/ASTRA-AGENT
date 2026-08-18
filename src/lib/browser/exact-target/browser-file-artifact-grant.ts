import { createHash, randomUUID } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type BrowserFileArtifactGrant = Readonly<{
  grantId: string;
  resolvedPath: string;
  device: number;
  inode: number;
  size: number;
  sha256: string;
  approvedRoot: string;
  issuedAt: string;
}>;

const hashFile = async (filePath: string): Promise<string> => {
  const handle = await open(filePath, "r");
  try {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(256 * 1024);
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
    }
    return `sha256:${hash.digest("hex")}`;
  } finally {
    await handle.close();
  }
};

const isInsideRoot = (candidate: string, root: string): boolean => {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

export const issueBrowserFileArtifactGrant = async (input: Readonly<{
  filePath: string;
  approvedRoots: readonly string[];
  maxBytes?: number;
}>): Promise<BrowserFileArtifactGrant> => {
  if (input.approvedRoots.length === 0) throw new Error("BROWSER_FILE_APPROVED_ROOT_REQUIRED");
  const resolvedPath = await realpath(input.filePath);
  const roots = await Promise.all(input.approvedRoots.map((root) => realpath(root)));
  const approvedRoot = roots.find((root) => isInsideRoot(resolvedPath, root));
  if (!approvedRoot) throw new Error("BROWSER_FILE_OUTSIDE_APPROVED_ROOT");
  const before = await stat(resolvedPath);
  if (!before.isFile()) throw new Error("BROWSER_FILE_NOT_REGULAR");
  const maxBytes = input.maxBytes ?? 128 * 1024 * 1024;
  if (before.size > maxBytes) throw new Error("BROWSER_FILE_TOO_LARGE");
  const sha256 = await hashFile(resolvedPath);
  const after = await stat(resolvedPath);
  if (
    before.dev !== after.dev
    || before.ino !== after.ino
    || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs
  ) {
    throw new Error("BROWSER_FILE_CHANGED_DURING_GRANT");
  }
  return Object.freeze({
    grantId: randomUUID(),
    resolvedPath,
    device: Number(after.dev),
    inode: Number(after.ino),
    size: after.size,
    sha256,
    approvedRoot,
    issuedAt: new Date().toISOString(),
  });
};
