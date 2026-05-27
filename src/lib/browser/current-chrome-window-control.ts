import { spawn } from "node:child_process";

type ChromeWindowState = {
  windowX: number;
  windowY: number;
  width: number;
  height: number;
  currentUrl: string;
  currentTitle: string;
};

type ChromeOpenReusePolicy = "reuse-exact-url" | "open-new-tab" | "reuse-active-tab";

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

const runJxa = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runSpawn("osascript", ["-l", "JavaScript", "-e", script], options);

const buildOpenUrlScript = (
  url: string,
  reusePolicy: ChromeOpenReusePolicy = "reuse-exact-url",
): string => {
  const escapedUrl = escapeAppleScriptString(url);
  const reuseExistingTabScript = reusePolicy === "reuse-exact-url"
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
  return `
tell application "Google Chrome" to activate
tell application "Google Chrome"
    if (count of windows) = 0 then
        make new window
        set URL of active tab of front window to "${escapedUrl}"
        return "opened_new_window"
    end if
  ${reuseExistingTabScript}
  ${reusePolicy === "reuse-active-tab"
    ? `
    set URL of active tab of front window to "${escapedUrl}"
    return "reused_active_tab"`
    : ""}
  ${reusePolicy === "open-new-tab"
    ? `
    tell front window
        make new tab with properties {URL:"${escapedUrl}"}
        set active tab index to (count of tabs)
    end tell
    return "opened_new_tab"`
    : ""}
end tell
`;
};

const readFrontChromeWindowState = async (): Promise<ChromeWindowState> => {
  const output = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
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
