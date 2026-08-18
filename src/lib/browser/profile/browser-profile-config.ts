import { existsSync } from "node:fs";
import path from "node:path";

import {
  GRASSEYE_BROWSER_EXTENSION_ID,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
} from "../release/browser-release-identity.js";
import {
  createBrowserProfileEnrollment,
  type BrowserProfileEnrollment,
} from "./browser-profile-enrollment.js";

const DEFAULT_CHROME_EXECUTABLE_PATHS: Readonly<Partial<Record<NodeJS.Platform, readonly string[]>>> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
  ],
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ],
};

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED_FOR_AUTHENTICATED_BROWSER_AUTHORITY`);
  return value;
};

const resolveChromeExecutablePath = (): string => {
  const configured = process.env.GRASSEYE_CHROME_EXECUTABLE?.trim();
  if (configured) {
    const resolved = path.resolve(configured);
    if (!existsSync(resolved)) throw new Error(`BROWSER_CHROME_EXECUTABLE_MISSING:${resolved}`);
    return resolved;
  }
  for (const candidate of DEFAULT_CHROME_EXECUTABLE_PATHS[process.platform] ?? []) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("BROWSER_CHROME_EXECUTABLE_NOT_FOUND");
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
  return createBrowserProfileEnrollment({
    platform: input.platform,
    profileRef,
    userDataDir,
    profileDirectory,
    chromeExecutablePath: resolveChromeExecutablePath(),
    extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
    releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
  });
};
