import { readFile } from "node:fs/promises";

import type { ExtensionDirectoryHashV1 } from "./extension-directory-hash-v1.js";

export const GRASSEYE_UNPACKED_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";

export type UnpackedExtensionReleaseIdentity = Readonly<{
  schemaVersion: "grasseye.browser.unpacked-release.v1";
  releaseBuildId: string;
  extensionId: string;
  version: string;
  extensionDirectoryHashV1: ExtensionDirectoryHashV1;
  manifestHash: `sha256:${string}`;
  protocolHash: `sha256:${string}`;
  sitePolicyHash: `sha256:${string}`;
  createdAt: string;
}>;

const hashPattern = /^sha256:[a-f0-9]{64}$/u;

export function assertUnpackedExtensionReleaseIdentity(value: unknown): asserts value is UnpackedExtensionReleaseIdentity {
  if (!isRecord(value)
    || value.schemaVersion !== "grasseye.browser.unpacked-release.v1"
    || typeof value.releaseBuildId !== "string" || !/^[a-z0-9][a-z0-9._-]{7,127}$/u.test(value.releaseBuildId)
    || value.extensionId !== GRASSEYE_UNPACKED_EXTENSION_ID
    || typeof value.version !== "string" || !/^\d+\.\d+\.\d+$/u.test(value.version)
    || !isHash(value.extensionDirectoryHashV1) || !isHash(value.manifestHash) || !isHash(value.protocolHash) || !isHash(value.sitePolicyHash)
    || typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) {
    throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
  }
}

export const readUnpackedExtensionReleaseIdentity = async (recordPath: string): Promise<UnpackedExtensionReleaseIdentity> => {
  const value: unknown = JSON.parse(await readFile(recordPath, "utf8"));
  assertUnpackedExtensionReleaseIdentity(value);
  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isHash = (value: unknown): value is `sha256:${string}` => typeof value === "string" && hashPattern.test(value);
