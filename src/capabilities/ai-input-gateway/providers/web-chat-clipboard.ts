import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";

const execFileAsync = promisify(execFile);
const APPLESCRIPT_TIMEOUT_MS = 10_000;
const PROVIDER_HOSTS = new Set(["chatgpt.com", "gemini.google.com"]);

const escapeAppleScriptText = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

export const copyTextToMacClipboard = async (
  text: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = `set the clipboard to "${escapeAppleScriptText(text)}"`;
  await execFileAsync("osascript", ["-e", script], {
    signal: abortSignal,
    timeout: APPLESCRIPT_TIMEOUT_MS,
  });
};

export const copyFileObjectToMacClipboard = async (
  filePath: string,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    `set targetFile to POSIX file "${escapeAppleScriptText(filePath)}" as alias`,
    'tell application "Finder"',
    "  activate",
    "  reveal targetFile",
    "  select targetFile",
    "end tell",
    'tell application "System Events"',
    '  tell process "Finder"',
    "    set frontmost to true",
    '    keystroke "c" using command down',
    "  end tell",
    "end tell",
    "delay 0.2",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
};

export const pasteMacClipboardIntoChrome = async (
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "System Events"',
    '  tell process "Google Chrome"',
    "    set frontmost to true",
    '    keystroke "v" using command down',
    "  end tell",
    "end tell",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
};

export const activateChromeForClipboardPaste = async (
  abortSignal?: AbortSignal,
): Promise<void> => {
  const script = [
    'tell application "Google Chrome" to activate',
    'tell application "System Events"',
    '  tell process "Google Chrome"',
    "    set frontmost to true",
    "  end tell",
    "end tell",
    "delay 0.2",
  ].join("\n");
  await execFileAsync("osascript", ["-e", script], { signal: abortSignal, timeout: APPLESCRIPT_TIMEOUT_MS });
};

type ComposerInsertResult = {
  host?: string;
  length?: number;
  status?: string;
};

const insertPromptInActiveProviderTab = async (
  browser: BrowserController,
  prompt: string,
  replace: boolean,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const pageScript = `(() => {
    const allowedHosts = ${JSON.stringify([...PROVIDER_HOSTS])};
    if (!allowedHosts.includes(location.host)) {
      return JSON.stringify({ status: "wrong_host", host: location.host });
    }
    ${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
    const composer = resolveComposerInput();
    if (!composer) return JSON.stringify({ status: "missing" });
    composer.focus();
    const prompt = ${JSON.stringify(prompt)};
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      if (!setter) return JSON.stringify({ status: "value_setter_missing" });
      const current = String(composer.value ?? '');
      if (!${replace ? "true" : "false"} && current.length > 0) {
        return JSON.stringify({ status: "already_filled", length: current.length });
      }
      setter.call(composer, prompt);
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    } else {
      const current = String(composer.innerText ?? composer.textContent ?? '');
      if (!${replace ? "true" : "false"} && current.length > 0) {
        return JSON.stringify({ status: "already_filled", length: current.length });
      }
      if (${replace ? "true" : "false"}) {
        const range = document.createRange();
        range.selectNodeContents(composer);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      const inserted = document.execCommand('insertText', false, prompt);
      if (!inserted) return JSON.stringify({ status: "insert_failed" });
      composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
    }
    const length = 'value' in composer ? String(composer.value ?? '').length : String(composer.innerText ?? composer.textContent ?? '').length;
    return JSON.stringify({ status: "inserted", host: location.host, length });
  })()`;
  const raw = await browser.evaluateActiveTab<string>({
    description: "insert governed prompt into the controlled provider composer",
    script: `return ${pageScript};`,
    ...(abortSignal ? { abortSignal } : {}),
  });
  const result = JSON.parse(raw) as ComposerInsertResult;
  if (result.status === "wrong_host") {
    throw new Error(`CHROME_PROVIDER_HOST_MISMATCH:${result.host ?? "unknown"}`);
  }
  if (result.status !== "inserted" && result.status !== "already_filled") {
    throw new Error(`CHROME_COMPOSER_INSERT_FAILED:${result.status ?? "unknown"}`);
  }
};

export const pasteTextAndSubmitInChrome = async (
  browser: BrowserController,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<void> => insertPromptInActiveProviderTab(browser, prompt, false, abortSignal);

export const pasteTextReplacingInChrome = async (
  browser: BrowserController,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<void> => insertPromptInActiveProviderTab(browser, prompt, true, abortSignal);
