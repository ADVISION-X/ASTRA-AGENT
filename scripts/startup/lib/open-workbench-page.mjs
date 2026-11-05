import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { ASTRA_LOCAL_ORIGIN } from "../../../src/lib/browser/profile/browser-application-identity.ts";

const MACOS_CHROME_APP_CANDIDATES = [
  "/Applications/Google Chrome.app",
  "/Applications/Google Chrome Beta.app",
];

const toFailureReason = (error) => (error instanceof Error ? error.message : String(error));

function runSpawn(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }

      reject(new Error(stderr.trim() || `Open command exited with code ${code ?? "unknown"}.`));
    });
  });
}

export function resolveMacOsChromeAppPath() {
  const configured = process.env.GRASSEYE_BROWSER_APP?.trim();
  if (configured && existsSync(configured)) return configured;
  const installed = MACOS_CHROME_APP_CANDIDATES.find(candidate => existsSync(candidate));
  if (!installed) throw new Error("Google Chrome.app was not found. Set GRASSEYE_BROWSER_APP to the installed Chrome .app path.");
  return installed;
}

export function getOpenCommand(url, platform = process.platform) {
  if (new URL(url).origin !== ASTRA_LOCAL_ORIGIN) throw new Error("ASTRA_WORKBENCH_ORIGIN_MISMATCH");
  if (platform === "darwin") {
    const browserPath = resolveMacOsChromeAppPath();
    return { command: "open", args: ["-a", browserPath, url], browserName: "Google Chrome", browserPath };
  }
  const browserPath = platform === "win32" ? "chrome" : "google-chrome";
  return { command: browserPath, args: [url], browserName: "Google Chrome", browserPath };
}

export async function openWorkbenchPage(url, platform = process.platform) {
  const command = getOpenCommand(url, platform);
  await runSpawn(command.command, command.args);
  return { ...command, handoffMode: "opened_current_chrome" };
}

export function buildChromeWindowRestoreScript(url) {
  if (new URL(url).origin !== ASTRA_LOCAL_ORIGIN) throw new Error("ASTRA_WORKBENCH_ORIGIN_MISMATCH");
  const escapedUrl = url.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `
if application "Google Chrome" is running then
    tell application "Google Chrome"
        if (count of windows) > 0 then return "already_visible"
    end tell
end if
tell application "Google Chrome"
    activate
    if (count of windows) = 0 then make new window
    set URL of active tab of front window to "${escapedUrl}"
    return "opened_new_window"
end tell
`;
}

export async function restoreWorkbenchWindowIfChromeHasNoWindow(url, platform = process.platform, spawnRunner = runSpawn) {
  if (platform !== "darwin") return { handoffMode: "unsupported_platform_noop" };
  if (spawnRunner === runSpawn) resolveMacOsChromeAppPath();
  const result = await spawnRunner("osascript", ["-e", buildChromeWindowRestoreScript(url)]);
  return { handoffMode: result.stdout || "opened_new_window" };
}
