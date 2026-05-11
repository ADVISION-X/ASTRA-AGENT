import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  LocalBrowserSessionConfigSchema,
  LocalBrowserSessionStateSchema,
  type BrowserProfileProvisioning,
  type BrowserProfileStatus,
  type LocalBrowserSessionConfig,
  type LocalBrowserSessionState,
} from "../../types/local-browser-session.js";

const DEFAULT_CHROME_EXECUTABLE_PATHS: Record<NodeJS.Platform, string[]> = {
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
    "/snap/bin/chromium",
  ],
  aix: [],
  android: [],
  cygwin: [],
  freebsd: [],
  haiku: [],
  netbsd: [],
  openbsd: [],
  sunos: [],
};

const BROWSER_PROFILE_ROOT = path.resolve(process.cwd(), ".grasseye-local", "browser-profiles");
const DEFAULT_PROFILE_REJECTION_REASON = "silent default managed profile is forbidden for real-platform proof; supply explicit browser profile ref and userDataDir";
const DEFAULT_CHROME_PROFILE_DIRECTORY = "Default";

const resolveProfileProvisioning = (input: {
  userDataDir?: string;
  profileRef?: string;
}): BrowserProfileProvisioning => input.userDataDir && input.profileRef ? "operator_supplied" : "managed_default";

const resolveProfileVerification = (profileProvisioning: BrowserProfileProvisioning): {
  profileVerificationStatus: "operator_verified" | "default_unverified";
  profileVerificationReason: string | null;
} => profileProvisioning === "operator_supplied"
  ? {
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "operator supplied explicit browser profile ref and userDataDir",
    }
  : {
      profileVerificationStatus: "default_unverified",
      profileVerificationReason: DEFAULT_PROFILE_REJECTION_REASON,
    };

const getLocalBrowserProfileDir = (platform: string): string =>
  path.join(BROWSER_PROFILE_ROOT, platform);

const readLastUsedChromeProfileDirectory = (userDataDir: string): string | null => {
  const localStatePath = path.join(userDataDir, "Local State");
  if (!existsSync(localStatePath)) {
    return null;
  }

  try {
    const localState = JSON.parse(readFileSync(localStatePath, "utf8")) as {
      profile?: { last_used?: unknown };
    };
    const lastUsed = localState.profile?.last_used;
    return typeof lastUsed === "string" && lastUsed.trim().length > 0 ? lastUsed.trim() : null;
  } catch (error) {
    process.stderr.write(`[local-browser-session] failed to read Local State profile.last_used: ${error instanceof Error ? error.message : String(error)}\n`);
    return null;
  }
};

const resolveLocalChromeProfileDirectory = (input: {
  userDataDir: string;
  profileDirectory?: string;
}): string => {
  const configuredProfileDirectory = input.profileDirectory?.trim() || process.env.GRASSEYE_CHROME_PROFILE_DIRECTORY?.trim();
  if (configuredProfileDirectory) {
    return configuredProfileDirectory;
  }

  return readLastUsedChromeProfileDirectory(input.userDataDir) ?? DEFAULT_CHROME_PROFILE_DIRECTORY;
};

const resolveLocalChromeExecutablePath = (): string | null => {
  const configuredPath = process.env.GRASSEYE_CHROME_EXECUTABLE?.trim();
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const candidates = DEFAULT_CHROME_EXECUTABLE_PATHS[process.platform] ?? [];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const createLocalBrowserSessionConfig = (input: {
  platform: string;
  userDataDir?: string;
  chromeExecutablePath?: string | null;
  profileRef?: string;
  profileDirectory?: string;
  createdAt?: string;
}): LocalBrowserSessionConfig => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const profileProvisioning = resolveProfileProvisioning(input);
  const profileVerification = resolveProfileVerification(profileProvisioning);
  const userDataDir = input.userDataDir ?? getLocalBrowserProfileDir(input.platform);
  const profileDirectory = resolveLocalChromeProfileDirectory({
    userDataDir,
    ...(input.profileDirectory ? { profileDirectory: input.profileDirectory } : {}),
  });
  return LocalBrowserSessionConfigSchema.parse({
    browserMode: "real_chrome_persistent",
    platform: input.platform,
    chromeExecutablePath: input.chromeExecutablePath ?? resolveLocalChromeExecutablePath(),
    profileRef: input.profileRef ?? `${input.platform}:persistent-local-profile`,
    userDataDir,
    profileDirectory,
    profileProvisioning,
    profileVerificationStatus: profileVerification.profileVerificationStatus,
    profileVerificationReason: profileVerification.profileVerificationReason ?? `resolved browser profile directory ${profileDirectory}`,
    headlessAllowed: false,
    createdAt,
    updatedAt: createdAt,
  });
};

const getBrowserProfileStatus = (userDataDir: string): BrowserProfileStatus =>
  existsSync(userDataDir) ? "profile_ready" : "profile_missing";

export const createInitialLocalBrowserSessionState = (
  config: LocalBrowserSessionConfig,
): LocalBrowserSessionState =>
  LocalBrowserSessionStateSchema.parse({
    browserMode: config.browserMode,
    browserProfileRef: config.profileRef,
    browserExecutablePath: config.chromeExecutablePath,
    profileStatus: getBrowserProfileStatus(config.userDataDir),
    profileDirectory: config.profileDirectory,
    profileProvisioning: config.profileProvisioning,
    profileVerificationStatus: config.profileVerificationStatus,
    profileVerificationReason: config.profileVerificationReason,
    loginState: "unknown",
    currentUrl: "about:blank",
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  });