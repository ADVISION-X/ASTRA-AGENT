import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type ChromeWindowState = {
  windowX: number;
  windowY: number;
  width: number;
  height: number;
  currentUrl: string;
  currentTitle: string;
};

type ChromeOpenReusePolicy = "reuse-exact-url" | "open-new-tab" | "reuse-active-tab" | "reuse-host-tab";

const escapeAppleScriptString = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const runSpawn = async (command: string, args: string[], options?: { signal?: AbortSignal }): Promise<string> => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...(options?.signal ? { signal: options.signal } : {}),
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
      resolve(stdout.trim());
      return;
    }

    reject(new Error(stderr.trim() || `${command} exited with code ${code ?? "unknown"}`));
  });
});

const runAppleScript = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runSpawn("osascript", ["-e", script], options);

const runJxa = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => {
  if (script.length < 1_000) {
    return runSpawn("osascript", ["-l", "JavaScript", "-e", script], options);
  }
  const tempDir = mkdtempSync(path.join(tmpdir(), "grasseye-jxa-"));
  const scriptPath = path.join(tempDir, "script.jxa");
  writeFileSync(scriptPath, script);
  try {
    return await runSpawn("osascript", ["-l", "JavaScript", scriptPath], options);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

const buildOpenUrlScript = (
  url: string,
  reusePolicy: ChromeOpenReusePolicy = "reuse-exact-url",
): string => {
  const escapedUrl = escapeAppleScriptString(url);
  const existingTabScript = buildReuseExactUrlScript(reusePolicy, escapedUrl);
  const hostTabScript = buildReuseHostTabScript(url, reusePolicy, escapedUrl);
  return `
tell application "Google Chrome" to activate
tell application "Google Chrome"
    if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${escapedUrl}"
        return "opened_new_window"
    end if
  ${existingTabScript}
  ${hostTabScript}
  ${buildPolicyNavigationScript(reusePolicy, escapedUrl)}
end tell
`;
};

function buildReuseExactUrlScript(reusePolicy: ChromeOpenReusePolicy, escapedUrl: string): string {
  return reusePolicy === "reuse-exact-url"
    ? `
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      if URL of t is "${escapedUrl}" then
        set active tab index of w to tIndex
        set index of w to 1
        return "focused_existing_tab"
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat`
    : "";
}

function buildReuseHostTabScript(
  url: string,
  reusePolicy: ChromeOpenReusePolicy,
  escapedUrl: string,
): string {
  const hostMatchPrefix = buildHostMatchPrefix(url);
  if (reusePolicy !== "reuse-host-tab" || !hostMatchPrefix) return "";
  const origin = escapeAppleScriptString(hostMatchPrefix.origin);
  const withSlash = escapeAppleScriptString(hostMatchPrefix.withSlash);
  return `
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl is "${origin}" or tabUrl starts with "${withSlash}" then
        set active tab index of w to tIndex
        set index of w to 1
        set URL of active tab of w to "${escapedUrl}"
        return "reused_host_tab"
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat`;
}

function buildPolicyNavigationScript(
  reusePolicy: ChromeOpenReusePolicy,
  escapedUrl: string,
): string {
  if (reusePolicy === "reuse-active-tab") return buildReuseActiveTabScript(escapedUrl);
  if (reusePolicy === "open-new-tab") return buildOpenNewTabScript(escapedUrl, "opened_new_tab");
  if (reusePolicy === "reuse-exact-url") return buildOpenNewTabScript(escapedUrl, "opened_new_tab");
  if (reusePolicy === "reuse-host-tab") return buildOpenNewTabScript(escapedUrl, "opened_new_host_tab");
  return "";
}

function buildReuseActiveTabScript(escapedUrl: string): string {
  return `
    set URL of active tab of front window to "${escapedUrl}"
    return "reused_active_tab"`;
}

function buildOpenNewTabScript(escapedUrl: string, result: string): string {
  return `
    tell front window
        make new tab with properties {URL:"${escapedUrl}"}
        set active tab index to (count of tabs)
    end tell
    return "${result}"`;
}

const buildHostMatchPrefix = (url: string): { origin: string; withSlash: string } | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { origin: parsed.origin, withSlash: `${parsed.origin}/` };
  } catch {
    return null;
  }
};

const readFrontChromeWindowState = async (fallbackUrl?: string): Promise<ChromeWindowState> => {
  const restoreUrl = fallbackUrl && fallbackUrl !== "about:blank"
    ? `set URL of active tab of front window to "${escapeAppleScriptString(fallbackUrl)}"`
    : "";
  const output = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
    if (count of windows) = 0 then
        make new window
        ${restoreUrl}
        delay 1
    end if
    if (count of windows) = 0 then
        return "NO_WINDOW"
    end if
    set windowBounds to bounds of front window
    set tabUrl to URL of active tab of front window
    set tabTitle to title of active tab of front window
    return (item 1 of windowBounds as string) & linefeed & (item 2 of windowBounds as string) & linefeed & (item 3 of windowBounds as string) & linefeed & (item 4 of windowBounds as string) & linefeed & tabUrl & linefeed & tabTitle
end tell
`);

  if (output === "NO_WINDOW") {
    throw new Error("Google Chrome window is not available for current-browser control.");
  }

  const [left, top, right, bottom, currentUrl, ...titleParts] = output.split(/\r?\n/);
  const windowX = Number(left);
  const windowY = Number(top);
  return {
    windowX,
    windowY,
    width: Number(right) - windowX,
    height: Number(bottom) - windowY,
    currentUrl: currentUrl?.trim() || "about:blank",
    currentTitle: titleParts.join(" ").trim() || "Google Chrome",
  };
};

export { runSpawn, runAppleScript, runJxa, buildOpenUrlScript, readFrontChromeWindowState };
export type { ChromeWindowState, ChromeOpenReusePolicy };
