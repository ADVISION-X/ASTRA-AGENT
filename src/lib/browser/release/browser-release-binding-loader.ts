import { verify } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import {
  assertBrowserReleaseBinding,
  type VerifiedBrowserReleaseBinding,
} from "./browser-release-contract.js";

const requireOwnedPrivateFile = (filePath: string, code: string): void => {
  if (!existsSync(filePath)) throw new Error(`${code}:missing`);
  const file = statSync(filePath);
  if (!file.isFile() || (file.mode & 0o077) !== 0)
    throw new Error(`${code}:permissions`);
  if (typeof process.geteuid === "function" && file.uid !== process.geteuid())
    throw new Error(`${code}:owner`);
};

const asBinding = (value: unknown): VerifiedBrowserReleaseBinding => {
  if (!value || typeof value !== "object")
    throw new Error("BROWSER_RELEASE_BINDING_INVALID:object required");
  const binding = value as VerifiedBrowserReleaseBinding;
  if (
    binding.artifactSet?.schemaVersion !== "browser-artifact-set.v1" ||
    binding.activationTuple?.schemaVersion !== "browser-activation-tuple.v1" ||
    binding.securityPolicy?.schemaVersion !==
      "browser-release-security-policy.v1"
  ) {
    throw new Error("BROWSER_RELEASE_BINDING_INVALID:schema version");
  }
  assertBrowserReleaseBinding(binding);
  return Object.freeze(binding);
};

/**
 * V3 runtime activation accepts one signed release binding only. The old V2
 * artifact manifest is deliberately not read here, so a legacy artifact can
 * never make an authority available by accident.
 */
export const readVerifiedBrowserReleaseBinding = (input: {
  artifactRoot: string;
  publicKeyPem: string;
}): VerifiedBrowserReleaseBinding => {
  const releaseDir = path.join(input.artifactRoot, "release-v3");
  const bindingPath = path.join(releaseDir, "browser-release-binding.json");
  const signaturePath = path.join(releaseDir, "browser-release-binding.sig");
  requireOwnedPrivateFile(bindingPath, "BROWSER_RELEASE_BINDING_INVALID");
  requireOwnedPrivateFile(
    signaturePath,
    "BROWSER_RELEASE_BINDING_SIGNATURE_INVALID",
  );
  const bindingBytes = readFileSync(bindingPath);
  const signature = readFileSync(signaturePath);
  if (!verify(null, bindingBytes, input.publicKeyPem, signature)) {
    throw new Error("BROWSER_RELEASE_BINDING_SIGNATURE_INVALID");
  }
  return asBinding(JSON.parse(bindingBytes.toString("utf8")));
};
