import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION = "grasseye-browser-profile-enrollment-v1" as const;

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

export const createBrowserProfileEnrollment = (input: Readonly<{
  platform: string;
  profileRef: string;
  userDataDir: string;
  profileDirectory: string;
  chromeExecutablePath: string;
  extensionId: string;
  releaseIdentity: string;
}>): BrowserProfileEnrollment => {
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
  const localStateHash = sha256(readFileSync(localStatePath));
  const identityMaterial = JSON.stringify({
    platform: input.platform,
    profileRef,
    userDataDir,
    profileDirectory,
    chromeExecutablePath,
    extensionId: input.extensionId,
    releaseIdentity: input.releaseIdentity,
    localStateHash,
  });
  return Object.freeze({
    schemaVersion: BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION,
    profileEnrollmentId: sha256(identityMaterial),
    platform: input.platform,
    profileRef,
    userDataDir,
    profileDirectory,
    chromeExecutablePath,
    extensionId: input.extensionId,
    releaseIdentity: input.releaseIdentity,
    localStateHash,
  });
};

export const readBrowserProfileEnrollment = (input: Readonly<{
  platform: string;
}>): BrowserProfileEnrollment => {
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
  if (!raw || typeof raw !== "object") {
    throw new Error("BROWSER_PROFILE_ENROLLMENT_INVALID:receipt must be an object");
  }
  const receipt = raw as Partial<BrowserProfileEnrollment>;
  if (
    receipt.schemaVersion !== BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION
    || typeof receipt.profileEnrollmentId !== "string"
    || typeof receipt.platform !== "string"
    || typeof receipt.profileRef !== "string"
    || typeof receipt.userDataDir !== "string"
    || typeof receipt.profileDirectory !== "string"
    || typeof receipt.chromeExecutablePath !== "string"
    || typeof receipt.extensionId !== "string"
    || typeof receipt.releaseIdentity !== "string"
    || typeof receipt.localStateHash !== "string"
  ) {
    throw new Error("BROWSER_PROFILE_ENROLLMENT_INVALID:receipt fields are incomplete");
  }
  if (receipt.platform !== input.platform) {
    throw new Error(`BROWSER_PROFILE_ENROLLMENT_PLATFORM_MISMATCH:${receipt.platform}`);
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
