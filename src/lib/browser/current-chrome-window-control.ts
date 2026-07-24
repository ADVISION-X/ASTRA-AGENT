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

type ChromeOpenReusePolicy = "reuse-exact-url" | "focus-existing-exact-url" | "focus-existing-same-path-url" | "open-new-tab" | "reuse-active-tab" | "reuse-host-tab";

const FOCUS_ONLY_MISSING_TAB_RESULT = "no_existing_tab";
const FOCUS_ONLY_SAME_PATH_TAB_RESULT = "focused_existing_same_path_tab";
const TRANSIENT_CHROME_EVENT_RETRY_LIMIT = 3;
const TRANSIENT_CHROME_EVENT_RETRY_DELAY_MS = 250;

const escapeAppleScriptString = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const runSpawn = async (command: string, args: string[], options?: { signal?: AbortSignal }): Promise<string> => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...(options?.signal ? { signal: options.signal } : {}),
  });
  let stdout = "";
  let stderr = "";

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
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

const isTransientChromeApplicationError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("(-600)")
    || message.includes("应用程序没有运行")
    || message.includes("Application isn’t running")
    || message.includes("Application isn't running");
};

const waitForTransientChromeRetry = async (signal?: AbortSignal): Promise<void> => {
  if (signal?.aborted) throw signal.reason ?? new Error("Chrome operation aborted");
  await new Promise<void>((resolve) => setTimeout(resolve, TRANSIENT_CHROME_EVENT_RETRY_DELAY_MS));
};

const runJxaOnce = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => {
  if (script.length < 1_000) return runSpawn("osascript", ["-l", "JavaScript", "-e", script], options);
  const tempDir = mkdtempSync(path.join(tmpdir(), "grasseye-jxa-"));
  const scriptPath = path.join(tempDir, "script.jxa");
  writeFileSync(scriptPath, script);
  try {
    return await runSpawn("osascript", ["-l", "JavaScript", scriptPath], options);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
};

const runJxa = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TRANSIENT_CHROME_EVENT_RETRY_LIMIT; attempt += 1) {
    try {
      return await runJxaOnce(script, options);
    } catch (error) {
      lastError = error;
      if (!isTransientChromeApplicationError(error) || attempt >= TRANSIENT_CHROME_EVENT_RETRY_LIMIT) throw error;
      await waitForTransientChromeRetry(options?.signal);
    }
  }
  throw lastError;
};

const buildOpenUrlScript = (
  url: string,
  reusePolicy: ChromeOpenReusePolicy = "reuse-exact-url",
): string => {
  const escapedUrl = escapeAppleScriptString(url);
  const existingTabScript = buildReuseExactUrlScript(reusePolicy, escapedUrl);
  const samePathTabScript = buildFocusSamePathUrlScript(url, reusePolicy);
  const hostTabScript = buildReuseHostTabScript(url, reusePolicy, escapedUrl);
  return `
tell application "Google Chrome" to activate
tell application "Google Chrome"
    ${buildFocusOnlyNoWindowScript(reusePolicy)}
    if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${escapedUrl}"
        return "opened_new_window"
    end if
  ${existingTabScript}
  ${samePathTabScript}
  ${hostTabScript}
  ${buildPolicyNavigationScript(reusePolicy, escapedUrl)}
end tell
`;
};

function buildReuseExactUrlScript(reusePolicy: ChromeOpenReusePolicy, escapedUrl: string): string {
  return reusePolicy === "reuse-exact-url" || reusePolicy === "focus-existing-exact-url" || reusePolicy === "focus-existing-same-path-url"
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
  end repeat
  ${reusePolicy === "focus-existing-exact-url" ? `return "${FOCUS_ONLY_MISSING_TAB_RESULT}"` : ""}`
    : "";
}

function buildFocusOnlyNoWindowScript(reusePolicy: ChromeOpenReusePolicy): string {
  return reusePolicy === "focus-existing-exact-url" || reusePolicy === "focus-existing-same-path-url"
    ? `
    if (count of windows) = 0 then
        return "${FOCUS_ONLY_MISSING_TAB_RESULT}"
    end if`
    : "";
}

function buildFocusSamePathUrlScript(url: string, reusePolicy: ChromeOpenReusePolicy): string {
  const match = buildSamePathMatch(url);
  if (reusePolicy !== "focus-existing-same-path-url" || !match) return "";
  const base = escapeAppleScriptString(match.base);
  const queryPrefix = escapeAppleScriptString(`${match.base}?`);
  const hashPrefix = escapeAppleScriptString(`${match.base}#`);
  return `
  repeat with w in windows
    set tIndex to 1
    repeat with t in tabs of w
      set tabUrl to URL of t
      if tabUrl is "${base}" or tabUrl starts with "${queryPrefix}" or tabUrl starts with "${hashPrefix}" then
        set active tab index of w to tIndex
        set index of w to 1
        return "${FOCUS_ONLY_SAME_PATH_TAB_RESULT}"
      end if
      set tIndex to tIndex + 1
    end repeat
  end repeat
  return "${FOCUS_ONLY_MISSING_TAB_RESULT}"`;
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
  if (reusePolicy === "focus-existing-exact-url") return `return "${FOCUS_ONLY_MISSING_TAB_RESULT}"`;
  if (reusePolicy === "focus-existing-same-path-url") return `return "${FOCUS_ONLY_MISSING_TAB_RESULT}"`;
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

const buildSamePathMatch = (url: string): { base: string } | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return { base: `${parsed.origin}${parsed.pathname}` };
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
    set tabUrl to URL of active tab of front window
    set tabTitle to title of active tab of front window
end tell
tell application "System Events"
    tell process "Google Chrome"
        set frontmost to true
        if (count of windows) = 0 then return "NO_WINDOW"
        set chromeWindowPosition to position of window 1
        set chromeWindowSize to size of window 1
    end tell
end tell
set windowLeft to item 1 of chromeWindowPosition
set windowTop to item 2 of chromeWindowPosition
set windowRight to windowLeft + (item 1 of chromeWindowSize)
set windowBottom to windowTop + (item 2 of chromeWindowSize)
return (windowLeft as string) & linefeed & (windowTop as string) & linefeed & (windowRight as string) & linefeed & (windowBottom as string) & linefeed & tabUrl & linefeed & tabTitle
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
