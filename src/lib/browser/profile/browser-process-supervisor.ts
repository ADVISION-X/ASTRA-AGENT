import { spawn } from "node:child_process";

import type { BrowserProfileEnrollment } from "./browser-profile-enrollment.js";

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export const ensureEnrolledBrowserProcess = async (
  enrollment: BrowserProfileEnrollment,
): Promise<void> => {
  const child = spawn(
    enrollment.chromeExecutablePath,
    [
      `--user-data-dir=${enrollment.userDataDir}`,
      `--profile-directory=${enrollment.profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-default-apps",
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  // The authority handshake, not this delay, is the readiness proof. The small
  // bounded delay only gives Chrome enough time to acquire or hand off to the
  // already-running enrolled profile before Native Messaging admission starts.
  await delay(750);
};
