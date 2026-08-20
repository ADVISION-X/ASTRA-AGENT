import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  GRASSEYE_BROWSER_RELEASE_SEQUENCE,
} from "./browser-release-identity.js";
import type { VerifiedBrowserArtifactSet } from "./verify-browser-artifact.mjs";

export type BrowserActivationReceipt = Readonly<{
  schemaVersion: "grasseye-browser-activation-v2";
  releaseIdentity: string;
  releaseSequence: number;
  minimumAcceptedReleaseSequence: number;
  protocolVersion: string;
  extensionId: string;
  extensionTreeSha256: string;
  artifactSetSha256: string;
  profileEnrollmentId: string;
  profileRef: string;
  userDataDir: string;
  profileDirectory: string;
  chromeExecutablePath: string;
  hostPath: string;
  hostSha256: string;
  controllerSocketPath: string;
  activatedAtUnixMs: number;
}>;

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const defaultReceiptPath = (): string => {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "GrassEye",
      "browser-runtime",
      "active-activation.json",
    );
  }
  if (process.platform === "linux") {
    return path.join(
      os.homedir(),
      ".config",
      "grasseye",
      "browser-runtime",
      "active-activation.json",
    );
  }
  throw new Error(
    `BROWSER_ACTIVATION_PLATFORM_UNSUPPORTED:${process.platform}`,
  );
};

const activationIdentityMatches = (
  receipt: BrowserActivationReceipt,
): boolean =>
  [
    receipt.schemaVersion === "grasseye-browser-activation-v2",
    receipt.releaseIdentity === GRASSEYE_BROWSER_RELEASE_IDENTITY,
    receipt.releaseSequence === GRASSEYE_BROWSER_RELEASE_SEQUENCE,
    receipt.releaseSequence >=
      GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
    receipt.minimumAcceptedReleaseSequence ===
      GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE,
    receipt.protocolVersion === GRASSEYE_BROWSER_PROTOCOL_VERSION,
    receipt.extensionId === GRASSEYE_BROWSER_EXTENSION_ID,
    HASH_PATTERN.test(receipt.extensionTreeSha256),
    HASH_PATTERN.test(receipt.artifactSetSha256),
    HASH_PATTERN.test(receipt.hostSha256),
    path.isAbsolute(receipt.userDataDir),
    path.isAbsolute(receipt.chromeExecutablePath),
    path.isAbsolute(receipt.hostPath),
    path.isAbsolute(receipt.controllerSocketPath),
    Boolean(receipt.profileRef),
    Boolean(receipt.profileEnrollmentId),
    Boolean(receipt.profileDirectory),
    Number.isFinite(receipt.activatedAtUnixMs),
  ].every(Boolean);

const activationArtifactMatches = (
  receipt: BrowserActivationReceipt,
  artifact: VerifiedBrowserArtifactSet,
): boolean =>
  [
    receipt.releaseIdentity === artifact.manifest.releaseIdentity,
    receipt.releaseSequence === artifact.manifest.releaseSequence,
    receipt.minimumAcceptedReleaseSequence ===
      artifact.manifest.minimumAcceptedReleaseSequence,
    receipt.protocolVersion === artifact.manifest.protocolVersion,
    receipt.extensionId === artifact.manifest.extensionId,
    receipt.extensionTreeSha256 === artifact.manifest.extension.treeSha256,
    receipt.hostSha256 === artifact.manifest.host.sha256,
    receipt.artifactSetSha256 === artifact.artifactSetSha256,
  ].every(Boolean);

export const readBrowserActivationReceipt = (
  input: Readonly<{
    artifactSet: VerifiedBrowserArtifactSet;
  }>,
): BrowserActivationReceipt => {
  const receiptPath = process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT?.trim()
    ? path.resolve(process.env.GRASSEYE_BROWSER_ACTIVATION_RECEIPT.trim())
    : defaultReceiptPath();
  if (!existsSync(receiptPath))
    throw new Error(`BROWSER_ACTIVATION_RECEIPT_MISSING:${receiptPath}`);
  const stat = statSync(receiptPath);
  if (!stat.isFile())
    throw new Error(`BROWSER_ACTIVATION_RECEIPT_NOT_FILE:${receiptPath}`);
  if ((stat.mode & 0o077) !== 0)
    throw new Error(
      `BROWSER_ACTIVATION_RECEIPT_PERMISSION_INVALID:${receiptPath}`,
    );
  if (typeof process.geteuid === "function" && stat.uid !== process.geteuid()) {
    throw new Error(`BROWSER_ACTIVATION_RECEIPT_OWNER_INVALID:${receiptPath}`);
  }
  const receipt = JSON.parse(
    readFileSync(receiptPath, "utf8"),
  ) as BrowserActivationReceipt;
  if (!activationIdentityMatches(receipt)) {
    throw new Error("BROWSER_ACTIVATION_RECEIPT_IDENTITY_MISMATCH");
  }
  if (!activationArtifactMatches(receipt, input.artifactSet)) {
    throw new Error("BROWSER_ACTIVATION_RECEIPT_ARTIFACT_MISMATCH");
  }
  return Object.freeze(receipt);
};
