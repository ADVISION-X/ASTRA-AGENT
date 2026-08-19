import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
} from "../release/browser-release-identity.js";

export const BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION = "grasseye-browser-profile-enrollment-v1" as const;

// Node calls macOS "darwin" while Rust's std::env::consts::OS calls it
// "macos". The receipt is a cross-language contract, so it uses the Rust
// spelling everywhere.
export const normalizeBrowserRuntimePlatform = (platform: string): string =>
  platform === "darwin" ? "macos" : platform;

export const browserProfileEnrollmentReceiptPath = (): string => {
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", "GrassEye", "browser-runtime", "profile-enrollment.json");
  }
  if (process.platform === "linux") {
    return path.join(homedir(), ".config", "grasseye", "browser-runtime", "profile-enrollment.json");
  }
  return path.join(homedir(), ".grasseye", "browser-runtime", "profile-enrollment.json");
};

export type BrowserProfileEnrollment = Readonly<{
  schemaVersion: typeof BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION;
  profileEnrollmentId: string;
  platform: string;
  profileRef: string;
  userDataDir: string;
  profileDirectory: string;
  chromeExecutablePath: string;
  extensionId: string;
  releaseIdentity: string;
  localStateHash: string;
}>;

const sha256 = (value: Buffer | string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const stableLocalStateIdentityHash = (input: Readonly<{
  localStatePath: string;
  profileDirectory: string;
}>): string => {
  const state = JSON.parse(readFileSync(input.localStatePath, "utf8")) as {
    profile?: { info_cache?: Record<string, Record<string, unknown>> };
  };
  const info = state.profile?.info_cache?.[input.profileDirectory];
  return sha256(JSON.stringify({
    profileDirectory: input.profileDirectory,
    profileInfo: {
      gaiaId: info?.gaia_id ?? null,
      name: info?.name ?? null,
      userName: info?.user_name ?? null,
    },
  }));
};

export const createBrowserProfileEnrollment = (input: Readonly<{
  platform: string;
  profileRef: string;
  userDataDir: string;
  profileDirectory: string;
  chromeExecutablePath: string;
  extensionId: string;
  releaseIdentity: string;
}>): BrowserProfileEnrollment => {
  const platform = normalizeBrowserRuntimePlatform(input.platform);
  const profileRef = input.profileRef.trim();
  const userDataDir = path.resolve(input.userDataDir);
  const profileDirectory = input.profileDirectory.trim();
  const chromeExecutablePath = path.resolve(input.chromeExecutablePath);
  if (!profileRef) throw new Error("BROWSER_PROFILE_REF_REQUIRED");
  if (!profileDirectory) throw new Error("BROWSER_PROFILE_DIRECTORY_REQUIRED");
  if (!input.extensionId.trim()) throw new Error("BROWSER_EXTENSION_ID_REQUIRED");
  if (!input.releaseIdentity.trim()) throw new Error("BROWSER_RELEASE_IDENTITY_REQUIRED");
  if (!existsSync(userDataDir)) throw new Error(`BROWSER_PROFILE_USER_DATA_DIR_MISSING:${userDataDir}`);
  if (!existsSync(chromeExecutablePath)) throw new Error(`BROWSER_CHROME_EXECUTABLE_MISSING:${chromeExecutablePath}`);
  const localStatePath = path.join(userDataDir, "Local State");
  if (!existsSync(localStatePath)) throw new Error(`BROWSER_PROFILE_LOCAL_STATE_MISSING:${localStatePath}`);
  const localStateHash = stableLocalStateIdentityHash({ localStatePath, profileDirectory });
  // Rust's serde_json map uses lexicographic key order for this contract.
  // Keep the TypeScript object in the same order so both sides derive the
  // same enrollment id from the same profile tuple.
  const identityMaterial = JSON.stringify({
    chromeExecutablePath,
    extensionId: input.extensionId,
    localStateHash,
    platform,
    profileDirectory,
    profileRef,
    releaseIdentity: input.releaseIdentity,
    userDataDir,
  });
  return Object.freeze({
    schemaVersion: BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION,
    profileEnrollmentId: sha256(identityMaterial),
    platform,
    profileRef,
    userDataDir,
    profileDirectory,
    chromeExecutablePath,
    extensionId: input.extensionId,
    releaseIdentity: input.releaseIdentity,
    localStateHash,
  });
};

const isCompleteProfileEnrollment = (raw: unknown): raw is BrowserProfileEnrollment => {
  if (!raw || typeof raw !== "object") return false;
  const receipt = raw as Partial<BrowserProfileEnrollment>;
  return [
    receipt.schemaVersion === BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION,
    typeof receipt.profileEnrollmentId === "string",
    typeof receipt.platform === "string",
    typeof receipt.profileRef === "string",
    typeof receipt.userDataDir === "string",
    typeof receipt.profileDirectory === "string",
    typeof receipt.chromeExecutablePath === "string",
    typeof receipt.extensionId === "string",
    typeof receipt.releaseIdentity === "string",
    typeof receipt.localStateHash === "string",
  ].every(Boolean);
};

export const readBrowserProfileEnrollment = (input: Readonly<{
  platform: string;
}>): BrowserProfileEnrollment => {
  const platform = normalizeBrowserRuntimePlatform(input.platform);
  const receiptPath = browserProfileEnrollmentReceiptPath();
  if (!existsSync(receiptPath)) {
    throw new Error(`BROWSER_PROFILE_ENROLLMENT_MISSING:${receiptPath}`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(receiptPath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`BROWSER_PROFILE_ENROLLMENT_INVALID:${reason}`);
  }
  if (!isCompleteProfileEnrollment(raw)) {
    throw new Error("BROWSER_PROFILE_ENROLLMENT_INVALID:receipt fields are incomplete");
  }
  const receipt = raw;
  if (receipt.platform !== platform) {
    throw new Error(`BROWSER_PROFILE_ENROLLMENT_PLATFORM_MISMATCH:${receipt.platform}`);
  }
  if (
    receipt.extensionId !== GRASSEYE_BROWSER_EXTENSION_ID
    || receipt.releaseIdentity !== GRASSEYE_BROWSER_RELEASE_IDENTITY
  ) {
    throw new Error("BROWSER_PROFILE_ENROLLMENT_TUPLE_INVALID:release identity mismatch");
  }
  const expected = createBrowserProfileEnrollment({
    platform: receipt.platform,
    profileRef: receipt.profileRef,
    userDataDir: receipt.userDataDir,
    profileDirectory: receipt.profileDirectory,
    chromeExecutablePath: receipt.chromeExecutablePath,
    extensionId: receipt.extensionId,
    releaseIdentity: receipt.releaseIdentity,
  });
  if (
    expected.profileEnrollmentId !== receipt.profileEnrollmentId
    || expected.extensionId !== receipt.extensionId
    || expected.releaseIdentity !== receipt.releaseIdentity
    || expected.localStateHash !== receipt.localStateHash
  ) {
    throw new Error("BROWSER_PROFILE_ENROLLMENT_TUPLE_INVALID:receipt does not match current profile state");
  }
  return Object.freeze({
    ...expected,
    profileEnrollmentId: receipt.profileEnrollmentId,
  });
};
