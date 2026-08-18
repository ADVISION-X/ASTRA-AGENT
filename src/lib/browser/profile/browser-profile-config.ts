import path from "node:path";

import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
} from "../release/browser-release-identity.js";
import {
  createBrowserProfileEnrollment,
  type BrowserProfileEnrollment,
} from "./browser-profile-enrollment.js";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED_FOR_AUTHENTICATED_BROWSER_AUTHORITY`);
  return value;
};

export const resolveProductionBrowserProfileEnrollment = (input: Readonly<{
  platform: string;
  profileDirectory?: string;
}>): BrowserProfileEnrollment => {
  const userDataDir = path.resolve(requireEnv("GRASSEYE_CHROME_USER_DATA_DIR"));
  const profileRef = requireEnv("GRASSEYE_BROWSER_PROFILE_REF");
  const profileDirectory = input.profileDirectory?.trim()
    || process.env.GRASSEYE_BROWSER_PROFILE_DIRECTORY?.trim()
    || "";
  if (!profileDirectory) {
    throw new Error("GRASSEYE_BROWSER_PROFILE_DIRECTORY_REQUIRED_FOR_AUTHENTICATED_BROWSER_AUTHORITY");
  }
  const chromeExecutablePath = path.resolve(requireEnv("GRASSEYE_CHROME_EXECUTABLE"));
  return createBrowserProfileEnrollment({
    platform: input.platform,
    profileRef,
    userDataDir,
    profileDirectory,
    chromeExecutablePath,
    extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
  });
};
