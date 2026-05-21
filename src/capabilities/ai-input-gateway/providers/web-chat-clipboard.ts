import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const escapeAppleScriptText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const copyFileObjectToMacClipboard = async (
  filePath: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = `set the clipboard to POSIX file "${escapeAppleScriptText(filePath)}"`;
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};

const copyTextToMacClipboard = async (
  text: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("pbcopy", [], { signal: abortSignal });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pbcopy exited with code ${String(code)}`));
    });
    child.stdin.end(text);
  });
};

export const pasteMacClipboardIntoChrome = async (
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    '  keystroke "v" using command down',
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};

export const clickDesktopPoint = async (
  point: { x: number; y: number },
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    `  click at {${Math.round(point.x)}, ${Math.round(point.y)}}`,
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};

export const pressEscapeInChrome = async (
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    "  key code 53",
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};

export const chooseFileInNativeDialog = async (
  filePath: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    "  delay 0.8",
    '  keystroke "g" using {command down, shift down}',
    "  delay 0.45",
    `  set the clipboard to "${escapeAppleScriptText(filePath)}"`,
    '  keystroke "v" using command down',
    "  delay 0.25",
    "  key code 36",
    "  delay 0.8",
    "  key code 36",
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};

export const pasteTextAndSubmitInChrome = async (
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  await copyTextToMacClipboard(prompt, abortSignal);
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    '  keystroke "v" using command down',
    "  delay 0.5",
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal });
};
