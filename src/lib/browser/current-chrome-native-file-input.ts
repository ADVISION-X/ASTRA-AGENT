import type { BrowserActionResult, BrowserController } from "./browser-controller.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import type { RuntimeState } from "./current-chrome-browser-controller-runtime.js";
import { activateChrome, clickAt, escapeAppleScriptText } from "./current-chrome-browser-controller-primitives.js";
import { runAppleScript } from "./current-chrome-window-control.js";

type SetFileInputFilesInput = Parameters<BrowserController["setFileInputFiles"]>[0];
type RefreshSnapshot = (state: RuntimeState) => Promise<unknown>;
type Sleep = (durationMs: number, abortSignal?: AbortSignal) => Promise<void>;
type EvaluateActiveTab = <T>(state: RuntimeState, input: { script: string; description: string; abortSignal?: AbortSignal }, refreshSnapshot: RefreshSnapshot) => Promise<T>;
type FileInputClickProbe = { status: string; message: string; x?: number; y?: number };
type NativeFileInputSelectionContext = {
  evaluateActiveTab: EvaluateActiveTab;
  state: RuntimeState;
  input: SetFileInputFilesInput;
  refreshSnapshot: RefreshSnapshot;
  sleep: Sleep;
};

const buildFileInputSelectionScript = (selector: string): string => `
const resolvedSelector = ${JSON.stringify(selector)};
const browserChromeTopInset = Math.max(0, window.outerHeight - window.innerHeight);
const clickPointFor = (target) => {
  const rect = target.getBoundingClientRect();
  return {x: Math.round(window.screenX + rect.x + rect.width / 2), y: Math.round(window.screenY + browserChromeTopInset + rect.y + rect.height / 2)};
};
const isVisibleInput = (input) => {
  const style = window.getComputedStyle(input);
  const rect = input.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
};
const shadowUpload = Array.from(document.querySelectorAll("kat-file-upload"))
  .map((host) => {
    const input = host.shadowRoot ? host.shadowRoot.querySelector("input[type='file']") : null;
    const button = host.shadowRoot ? host.shadowRoot.querySelector("kat-button#select-file") : null;
    return input instanceof HTMLInputElement ? { input, button: button || input } : null;
  })
  .find(Boolean);
const matches = Array.from(document.querySelectorAll(resolvedSelector));
if (matches.length === 0 && !shadowUpload) return {status: "not_found", message: "file input not found"};
if (matches.length > 1) return {status: "ambiguous", message: "file input selector matched multiple elements"};
const candidate = matches[0];
if (shadowUpload && (!candidate || !isVisibleInput(candidate))) {
  const point = clickPointFor(shadowUpload.button);
  return {status: "native_click_required", message: "native click required for shadow file input", x: point.x, y: point.y};
}
const el = candidate;
if (!(el instanceof HTMLInputElement) || el.type !== "file") return {status: "failed", message: "target is not input[type=file]"};
const point = clickPointFor(el);
return {status: "native_click_required", message: "native click required for file input", x: point.x, y: point.y};
`;

const buildFileInputVerificationScript = (selector: string): string => `
const resolvedSelector = ${JSON.stringify(selector)};
const shadowInputs = Array.from(document.querySelectorAll("kat-file-upload"))
  .map((host) => host.shadowRoot ? host.shadowRoot.querySelector("input[type='file']") : null)
  .filter((input) => input instanceof HTMLInputElement);
const matches = Array.from(document.querySelectorAll(resolvedSelector));
const inputs = [...matches, ...shadowInputs].filter((el) => el instanceof HTMLInputElement && el.type === "file");
if (inputs.length === 0) return {status: "failed", message: "file input verification requires a matched file input"};
const attached = inputs.some((el) => el.files && el.files.length > 0);
return {status: attached ? "success" : "failed", message: attached ? "approved file is attached" : "file input has no attached file"};
`;

const pasteApprovedFilePathIntoChooser = async (filePath: string, abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
  delay 0.8
  set the clipboard to "${escapeAppleScriptText(filePath)}"
  keystroke "g" using {command down, shift down}
  delay 0.45
  keystroke "v" using command down
  delay 0.25
  key code 36
  delay 0.8
  key code 36
  delay 0.5
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const probeFileInputNativeClick = (
  evaluateActiveTab: EvaluateActiveTab,
  state: RuntimeState,
  input: SetFileInputFilesInput,
  refreshSnapshot: RefreshSnapshot,
): Promise<FileInputClickProbe> =>
  evaluateActiveTab<FileInputClickProbe>(state, {
    description: input.description,
    script: buildFileInputSelectionScript(input.elementRef.selector),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  }, refreshSnapshot);

const clickNativeFileInput = async (
  input: SetFileInputFilesInput,
  clickResult: FileInputClickProbe,
): Promise<BrowserActionResult | null> => {
  if (clickResult.status !== "native_click_required") return clickResult.status === "success" ? null : createCurrentChromeBrowserActionResult({ ok: false, message: clickResult.message });
  if (typeof clickResult.x !== "number" || typeof clickResult.y !== "number") return createCurrentChromeBrowserActionResult({ ok: false, message: "file chooser native click point was not available" });
  await activateChrome(input.abortSignal);
  await clickAt(clickResult.x, clickResult.y, "left", 1);
  return null;
};

export const runNativeFileInputSelection = async (
  context: NativeFileInputSelectionContext,
): Promise<BrowserActionResult | null> => {
  const { evaluateActiveTab, state, input, refreshSnapshot, sleep } = context;
  const clickFailure = await clickNativeFileInput(input, await probeFileInputNativeClick(evaluateActiveTab, state, input, refreshSnapshot));
  if (clickFailure) return clickFailure;
  await activateChrome(input.abortSignal);
  await sleep(1200, input.abortSignal);
  await pasteApprovedFilePathIntoChooser(input.filePath, input.abortSignal);
  await sleep(1400, input.abortSignal);
  const verification = await evaluateActiveTab<FileInputClickProbe>(state, {
    description: "verify approved file selected on located file input",
    script: buildFileInputVerificationScript(input.elementRef.selector),
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  }, refreshSnapshot);
  return verification.status === "success" ? null : createCurrentChromeBrowserActionResult({ ok: false, message: verification.message });
};
