import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const APPLESCRIPT_TIMEOUT_MS = 10_000;

const escapeAppleScriptText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const copyFileObjectToMacClipboard = async (
  filePath: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = `set the clipboard to POSIX file "${escapeAppleScriptText(filePath)}"`;
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
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
    '  keystroke "a" using command down',
    "  delay 0.2",
    '  keystroke "v" using command down',
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
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
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
};

export const pressReturnInChrome = async (
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    "  delay 2",
    '  key code 36',
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
};
