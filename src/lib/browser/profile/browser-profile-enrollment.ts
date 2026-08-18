import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const BROWSER_PROFILE_ENROLLMENT_SCHEMA_VERSION = "grasseye-browser-profile-enrollment-v1" as const;

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
