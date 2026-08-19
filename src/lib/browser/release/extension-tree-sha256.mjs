import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const sha256Bytes = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const compareUtf8 = (left, right) => Buffer.from(left, "utf8").compare(Buffer.from(right, "utf8"));

const canonicalRelativePath = (root, candidate) => {
  const relative = path.relative(root, candidate).split(path.sep).join("/");
  if (!relative || path.isAbsolute(relative) || relative.split("/").includes("..")) {
    throw new Error(`BROWSER_EXTENSION_TREE_PATH_INVALID:${candidate}`);
  }
  return relative;
};

const collect = async (root, directory, files) => {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => compareUtf8(left.name, right.name));
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink()) throw new Error(`BROWSER_EXTENSION_TREE_SYMLINK_FORBIDDEN:${candidate}`);
    if (metadata.isDirectory()) {
      await collect(root, candidate, files);
      continue;
    }
    if (!metadata.isFile()) throw new Error(`BROWSER_EXTENSION_TREE_SPECIAL_FILE_FORBIDDEN:${candidate}`);
    files.push(Object.freeze({
      path: canonicalRelativePath(root, candidate),
      size: metadata.size,
      sha256: sha256Bytes(await readFile(candidate)),
    }));
  }
};

export const extensionTreeIdentity = async (extensionRoot) => {
  const root = path.resolve(extensionRoot);
  const rootMetadata = await lstat(root);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error(`BROWSER_EXTENSION_TREE_ROOT_INVALID:${root}`);
  }
  const files = [];
  await collect(root, root, files);
  files.sort((left, right) => compareUtf8(left.path, right.path));
  const canonicalBytes = Buffer.from(JSON.stringify({ files }), "utf8");
  return Object.freeze({
    files: Object.freeze(files),
    sha256: sha256Bytes(canonicalBytes),
  });
};
