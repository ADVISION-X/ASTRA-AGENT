import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ScreenshotStructuredRef } from "../contract.js";

function assertInsideRoot(rootDir: string, candidatePath: string): string {
  const resolvedRootDir = path.resolve(rootDir);
  const resolvedPath = path.resolve(candidatePath);
  const relativePath = path.relative(resolvedRootDir, resolvedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("structured ref target escaped governed screenshot root");
  }
  return resolvedPath;
}

export async function persistScreenshotStructuredDataRef(input: {
  rootDir: string;
  childCapabilityId: string;
  fileName: string;
  refId: string;
  createdAt: string;
  payload: unknown;
}): Promise<ScreenshotStructuredRef> {
  const dir = assertInsideRoot(input.rootDir, path.join(input.rootDir, "structured", input.childCapabilityId));
  await mkdir(dir, { recursive: true });

  const json = JSON.stringify(input.payload, null, 2);
  const sha256 = createHash("sha256").update(json).digest("hex");
  const storageRef = assertInsideRoot(input.rootDir, path.join(dir, input.fileName));
  await writeFile(storageRef, json, "utf8");

  return {
    refId: input.refId,
    storageRef,
    sha256,
    mimeType: "application/json",
    createdAt: input.createdAt,
  };
}