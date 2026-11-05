import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { ASTRA_LOCAL_ORIGIN } from "../../../src/lib/browser/profile/browser-application-identity.js";

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

const appleScriptString = (value) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

function shellUrl(url) {
  const target = new URL(url);
  if (target.href !== `${ASTRA_LOCAL_ORIGIN}/`) throw new Error("ASTRA_WORKBENCH_ORIGIN_MISMATCH");
  return target.href;
}

function chromeShellSelection(url, browserPath) {
  const application = appleScriptString(browserPath);
  const shell = appleScriptString(shellUrl(url));
  return `
if application "${application}" is running then
    tell application "${application}"
        repeat with browserWindow in windows
            set tabNumber to 0
            repeat with shellTab in tabs of browserWindow
                set tabNumber to tabNumber + 1
                if URL of shellTab is "${shell}" then
                    set active tab index of browserWindow to tabNumber
                    set index of browserWindow to 1
                    activate
                    return "reused_shell_tab"
                end if
            end repeat
        end repeat
        if (count of windows) > 0 then
            tell front window
                make new tab at end of tabs with properties {URL:"${shell}"}
                set active tab index to (count of tabs)
            end tell
            activate
            return "opened_shell_tab"
        end if
    end tell
end if
${buildChromeWindowRestoreScript(url, browserPath)}`;
}

export function getOpenCommand(url, platform = process.platform) {
  const target = shellUrl(url);
  if (platform === "darwin") {
    const browserPath = resolveMacOsChromeAppPath();
    return { command: "osascript", args: ["-e", chromeShellSelection(target, browserPath)],
      browserName: "Google Chrome", browserPath };
  }
  const browserPath = platform === "win32" ? "chrome" : "google-chrome";
  return { command: browserPath, args: [target], browserName: "Google Chrome", browserPath };
}

export async function openWorkbenchPage(url, platform = process.platform, spawnRunner = runSpawn) {
  const command = getOpenCommand(url, platform);
  const result = await spawnRunner(command.command, command.args);
  const handoffMode = platform === "darwin" ? result.stdout : "opened_current_chrome";
  if (!["reused_shell_tab", "opened_shell_tab", "opened_new_window", "opened_current_chrome"].includes(handoffMode)) {
    throw new Error("WORKBENCH_OPEN_RESULT_INVALID");
  }
  return { ...command, handoffMode };
}

export function buildChromeWindowRestoreScript(url, browserApp = "Google Chrome") {
  const escapedUrl = appleScriptString(shellUrl(url));
  const application = appleScriptString(browserApp);
  return `
if application "${application}" is running then
    tell application "${application}"
        if (count of windows) > 0 then return "already_visible"
    end tell
end if
tell application "${application}"
    activate
    if (count of windows) = 0 then make new window
    set URL of active tab of front window to "${escapedUrl}"
    return "opened_new_window"
end tell
`;
}

export async function restoreWorkbenchWindowIfChromeHasNoWindow(url, platform = process.platform, spawnRunner = runSpawn) {
  if (platform !== "darwin") return { handoffMode: "unsupported_platform_noop" };
  const browserPath = spawnRunner === runSpawn ? resolveMacOsChromeAppPath() : undefined;
  const result = await spawnRunner("osascript", ["-e", buildChromeWindowRestoreScript(url, browserPath)]);
  return { handoffMode: result.stdout || "opened_new_window" };
}
