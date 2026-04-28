import { spawn } from "node:child_process";

export type ChromeWindowState = {
  windowX: number;
  windowY: number;
  width: number;
  height: number;
  currentUrl: string;
  currentTitle: string;
};

const escapeAppleScriptString = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

export const runSpawn = async (command: string, args: string[]): Promise<string> => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
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

export const runAppleScript = async (script: string): Promise<string> => runSpawn("osascript", ["-e", script]);

export const runJxa = async (script: string): Promise<string> => runSpawn("osascript", ["-l", "JavaScript", "-e", script]);

export const buildOpenUrlScript = (url: string): string => {
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
            if URL of t is "${escapedUrl}" then
                set active tab index of w to tIndex
                set index of w to 1
                return "focused_existing_tab"
            end if
            set tIndex to tIndex + 1
        end repeat
    end repeat
    tell front window
        make new tab with properties {URL:"${escapedUrl}"}
        set active tab index to (count of tabs)
    end tell
    return "opened_new_tab"
end tell
`;
};

export const activateChrome = async (): Promise<void> => {
  await runAppleScript('tell application "Google Chrome" to activate');
};

export const openUrlInChrome = async (url: string): Promise<void> => {
  await runAppleScript(buildOpenUrlScript(url));
};

export const readFrontChromeWindowState = async (): Promise<ChromeWindowState> => {
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

export const clickAt = async (x: number, y: number): Promise<void> => {
  await runJxa(`
ObjC.import('ApplicationServices');
function post(type, x, y) {
  const point = $.CGPointMake(x, y);
  const event = $.CGEventCreateMouseEvent(null, type, point, $.kCGMouseButtonLeft);
  $.CGEventPost($.kCGHIDEventTap, event);
}
post($.kCGEventMouseMoved, ${x}, ${y});
delay(0.02);
post($.kCGEventLeftMouseDown, ${x}, ${y});
delay(0.02);
post($.kCGEventLeftMouseUp, ${x}, ${y});
`);
};

export const pressBrowserKey = async (keyCode: number): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    key code ${keyCode}
end tell
`);
};