import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

import type { BrowserProfileEnrollment } from "./browser-profile-enrollment.js";

export type BrowserChromeProcessAttestation = Readonly<{
  processEpoch: number;
  pid: number;
  processStartToken: string;
  chromeVersion: string;
  chromeProcessIncarnationHash: `sha256:${string}`;
  executablePathHash: `sha256:${string}`;
  userDataDirHash: `sha256:${string}`;
  profileDirectoryHash: `sha256:${string}`;
  startedBySupervisor: boolean;
}>;

let processEpoch = 0;

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const chromeVersion = (executable: string): string => {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error("BROWSER_CHROME_PROCESS_IDENTITY_INVALID:version unavailable");
  }
  return result.stdout.trim();
};

const processStartToken = (pid: number): string => {
  if (process.platform === "win32") {
    const result = spawnSync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('O')`,
    ], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      throw new Error("BROWSER_CHROME_PROCESS_IDENTITY_INVALID:start token");
    }
    return result.stdout.trim();
  }
  const result = spawnSync("/bin/ps", [
    "-p",
    String(pid),
    "-o",
    "lstart=",
  ], { encoding: "utf8" });
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("BROWSER_CHROME_PROCESS_IDENTITY_INVALID:start token");
  }
  return result.stdout.trim().replaceAll(/\s+/gu, " ");
};

const findApprovedChromeProcess = (
  enrollment: BrowserProfileEnrollment,
): number | null => {
  if (process.platform === "win32") return null;
  const result = spawnSync("/bin/ps", ["-axo", "pid=,command="], { encoding: "utf8" });
  if (result.error || result.status !== 0) return null;
  const userData = `--user-data-dir=${enrollment.userDataDir}`;
  const profile = `--profile-directory=${enrollment.profileDirectory}`;
  for (const raw of result.stdout.split("\n")) {
    const match = raw.trim().match(/^(\d+)\s+(.+)$/u);
    if (!match) continue;
    const command = match[2]!;
    if (
      command.includes(enrollment.chromeExecutablePath)
      && command.includes(userData)
      && command.includes(profile)
    ) return Number(match[1]);
  }
  return null;
};

export const browserChromeProcessIncarnationMaterial = (input: {
  pid: number;
  processStartToken: string;
  chromeExecutablePath: string;
  userDataDir: string;
  profileDirectory: string;
  profileEnrollmentId: string;
  chromeVersion: string;
}): string => [
  `pid=${input.pid}`,
  `processStartToken=${input.processStartToken}`,
  `chromeExecutablePath=${input.chromeExecutablePath}`,
  `userDataDir=${input.userDataDir}`,
  `profileDirectory=${input.profileDirectory}`,
  `profileEnrollmentId=${input.profileEnrollmentId}`,
  `chromeVersion=${input.chromeVersion}`,
].join("\n");

export const ensureEnrolledBrowserProcess = async (
  enrollment: BrowserProfileEnrollment,
): Promise<BrowserChromeProcessAttestation> => {
  const existing = findApprovedChromeProcess(enrollment);
  let pid = existing;
  let startedBySupervisor = false;
  if (!pid) {
    const child = spawn(enrollment.chromeExecutablePath, [
      `--user-data-dir=${enrollment.userDataDir}`,
      `--profile-directory=${enrollment.profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
    ], { detached: true, stdio: "ignore" });
    child.unref();
    if (!child.pid) throw new Error("BROWSER_CHROME_PROCESS_IDENTITY_INVALID:no pid");
    pid = child.pid;
    startedBySupervisor = true;
    await new Promise((resolve) => setTimeout(resolve, 750));
    pid = findApprovedChromeProcess(enrollment) ?? pid;
  }
  const startToken = processStartToken(pid);
  const version = chromeVersion(enrollment.chromeExecutablePath);
  const incarnation = browserChromeProcessIncarnationMaterial({
    pid,
    processStartToken: startToken,
    chromeExecutablePath: enrollment.chromeExecutablePath,
    userDataDir: enrollment.userDataDir,
    profileDirectory: enrollment.profileDirectory,
    profileEnrollmentId: enrollment.profileEnrollmentId,
    chromeVersion: version,
  });
  return Object.freeze({
    processEpoch: ++processEpoch,
    pid,
    processStartToken: startToken,
    chromeVersion: version,
    chromeProcessIncarnationHash: hash(incarnation),
    executablePathHash: hash(enrollment.chromeExecutablePath),
    userDataDirHash: hash(enrollment.userDataDir),
    profileDirectoryHash: hash(enrollment.profileDirectory),
    startedBySupervisor,
  });
};
