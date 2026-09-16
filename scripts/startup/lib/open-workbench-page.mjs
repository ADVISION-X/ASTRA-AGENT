import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const MACOS_CHROME_APP_CANDIDATES = [
  "/Applications/Google Chrome.app",
  "/Applications/Google Chrome Beta.app",
];

const toFailureReason = (error) => (error instanceof Error ? error.message : String(error));

function escapeAppleScriptString(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

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

function buildChromeTabHandoffScript(url) {
  const escapedUrl = escapeAppleScriptString(url);
  return `
tell application "Google Chrome" to activate
tell application "Google Chrome"
    if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${escapedUrl}"
        return "opened_new_window"
    end if
    repeat with w in windows
        set tIndex to 1
        repeat with t in tabs of w
            set u to URL of t
            if u is "${escapedUrl}" then
                set active tab index of w to tIndex
                set index of w to 1
                return "focused_existing_tab"
            end if
            set tIndex to tIndex + 1
        end repeat
    end repeat
    set frontTabUrl to URL of active tab of front window
    if frontTabUrl is "${escapedUrl}" then
        return "already_open"
    end if
    tell front window
        make new tab with properties {URL:"${escapedUrl}"}
        set active tab index to (count of tabs)
    end tell
    return "opened_new_tab"
end tell
`;
}

export function buildChromeWindowRestoreScript(url) {
  const escapedUrl = escapeAppleScriptString(url);
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

async function handoffToCurrentChromeTab(url) {
  const browserAppPath = resolveMacOsChromeAppPath();
  const result = await runSpawn("osascript", ["-e", buildChromeTabHandoffScript(url)]);
  return {
    browserName: "Google Chrome",
    browserPath: browserAppPath,
    command: "osascript",
    args: ["-e", buildChromeTabHandoffScript(url)],
    handoffMode: result.stdout || "focused_existing_tab",
  };
}

async function tryMacOsChromeHandoff(url) {
  try {
    return await handoffToCurrentChromeTab(url);
  } catch (error) {
    throw new Error(`Chrome tab handoff failed: ${toFailureReason(error)}`);
  }
}

export function resolveMacOsChromeAppPath() {
  const configuredAppPath = process.env.GRASSEYE_BROWSER_APP?.trim();
  if (configuredAppPath && existsSync(configuredAppPath)) {
    return configuredAppPath;
  }

  for (const candidate of MACOS_CHROME_APP_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Google Chrome.app was not found on this macOS host. Set GRASSEYE_BROWSER_APP to the installed Chrome .app path.");
}

export function getOpenCommand(url, platform = process.platform) {
  if (platform === "darwin") {
    const browserAppPath = resolveMacOsChromeAppPath();
    return {
      command: "open",
      args: ["-a", browserAppPath, url],
      browserName: "Google Chrome",
      browserPath: browserAppPath,
    };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", "chrome", url], browserName: "Google Chrome", browserPath: "chrome" };
  }

  return { command: "google-chrome", args: [url], browserName: "Google Chrome", browserPath: "google-chrome" };
}

export async function openMainPage(url, platform = process.platform) {
  if (platform === "darwin") {
    return tryMacOsChromeHandoff(url);
  }

  const { command, args, browserName, browserPath } = getOpenCommand(url, platform);
  await runSpawn(command, args, { stdio: "ignore" });

  return {
    browserName,
    browserPath,
    command,
    args,
  };
}

export async function openWorkbenchPage(url, platform = process.platform) {
  return openMainPage(url, platform);
}

export async function restoreWorkbenchWindowIfChromeHasNoWindow(
  url,
  platform = process.platform,
  spawnRunner = runSpawn,
) {
  if (platform !== "darwin") return { handoffMode: "unsupported_platform_noop" };
  if (spawnRunner === runSpawn) resolveMacOsChromeAppPath();
  const result = await spawnRunner("osascript", ["-e", buildChromeWindowRestoreScript(url)]);
  return { handoffMode: result.stdout || "already_visible" };
}
