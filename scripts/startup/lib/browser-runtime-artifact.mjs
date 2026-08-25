import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { runBrowserRuntimePreflight } from "./browser-runtime-preflight.mjs";

const execFile = promisify(execFileCallback);

export async function ensureCurrentBrowserRuntimeArtifact({
  rootDir,
  runBuild = async () => {
    await execFile(process.execPath, ["src/lib/browser/chrome-extension/build.mjs"], {
      cwd: rootDir,
      maxBuffer: 16 * 1024 * 1024,
    });
  },
  readPreflight = runBrowserRuntimePreflight,
}) {
  const before = await readPreflight();
  if (before.status === "READY" && before.releaseState === "UNPACKED_WEBSOCKET_AUTHORITY") {
    return Object.freeze({ rebuilt: false, preflight: before });
  }

  await runBuild();
  const after = await readPreflight();
  if (after.status !== "READY" || after.releaseState !== "UNPACKED_WEBSOCKET_AUTHORITY") {
    throw new Error(`${after.failureReason ?? "BROWSER_UNPACKED_ARTIFACT_REBUILD_FAILED"}: ${after.actionableMessage ?? "Browser extension rebuild did not produce a current fixed artifact."}`);
  }
  return Object.freeze({ rebuilt: true, preflight: after });
}
