import { createId } from "../local-runtime/ids.js";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
} from "./browser-controller.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import type { RuntimeState } from "./current-chrome-browser-controller-runtime.js";
import {
  activateChrome,
  escapeAppleScriptText,
  keystrokeBrowserText,
  pressBrowserKey,
} from "./current-chrome-browser-controller-primitives.js";
import { runAppleScript } from "./current-chrome-window-control.js";
import { captureCurrentChromeScreenshot } from "./current-chrome-browser-screenshot.js";
import { executeCurrentChromeTextInput } from "./current-chrome-browser-text-input.js";

type TextInput = Parameters<BrowserController["textInput"]>[0];
type ScreenshotRegionInput = Parameters<BrowserController["screenshotRegion"]>[0];
export type EvaluateActiveTabInput = {
  script: string;
  description: string;
  abortSignal?: AbortSignal;
};
type SetFileInputFilesInput = Parameters<BrowserController["setFileInputFiles"]>[0];

type RefreshSnapshot = (state: RuntimeState) => Promise<unknown>;
type GetGeometrySnapshot = (state: RuntimeState) => Promise<BrowserGeometrySnapshot>;
type Sleep = (durationMs: number, abortSignal?: AbortSignal) => Promise<void>;

const buildWrappedActiveTabScript = (script: string): string => `
(async () => {
  const result = await (async () => {
${script}
  })();
  return JSON.stringify(result ?? null);
})()
`;

const buildFileInputSelectionScript = (selector: string): string => `
const resolvedSelector = ${JSON.stringify(selector)};
const matches = Array.from(document.querySelectorAll(resolvedSelector));
if (matches.length === 0) return {status: "not_found", message: "file input not found"};
if (matches.length > 1) return {status: "ambiguous", message: "file input selector matched multiple elements"};
const el = matches[0];
if (!(el instanceof HTMLInputElement) || el.type !== "file") return {status: "failed", message: "target is not input[type=file]"};
el.click();
return {status: "success", message: "file chooser opened for approved file"};
`;

export const textInputCurrentChrome = async (
  state: RuntimeState,
  input: TextInput,
  refreshSnapshot: RefreshSnapshot,
): Promise<BrowserActionResult> => {
  const result = await executeCurrentChromeTextInput(input, () => createId("browser"));
  await refreshSnapshot(state);
  return result;
};

export const screenshotCurrentChromeRegion = async (
  state: RuntimeState,
  input: ScreenshotRegionInput,
  getGeometrySnapshot: GetGeometrySnapshot,
  refreshSnapshot: RefreshSnapshot,
): Promise<BrowserCaptureResult> => {
  const geometry = await getGeometrySnapshot(state);
  const screenshot = await captureCurrentChromeScreenshot({
    screenshotDir: state.options.screenshotDir,
    geometry,
    regionLabel: input.regionLabel,
    allowFullscreenRetry: input.captureProfile !== "observation_lightweight",
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
  await refreshSnapshot(state);

  return {
    browserActionId: createId("browser"),
    pageUrl: state.snapshot.currentUrl,
    pageTitle: state.snapshot.currentTitle,
    regionLabel: input.regionLabel,
    regionType: "viewport",
    width: screenshot.dimensions.width,
    height: screenshot.dimensions.height,
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
    ...(input.contentLines ? { contentLines: input.contentLines } : {}),
    sourceFilePath: screenshot.screenshotPath,
    createdAt: new Date().toISOString(),
  };
};

export const evaluateActiveTab = async <T>(
  state: RuntimeState,
  input: EvaluateActiveTabInput,
  refreshSnapshot: RefreshSnapshot,
): Promise<T> => {
  const forbiddenStorageReads = /\bdocument\.cookie\b|\blocalStorage\b|\bsessionStorage\b|\bouterHTML\b|\bdocument\.documentElement\.innerHTML\b/iu;
  if (forbiddenStorageReads.test(input.script)) {
    throw new Error(`Active-tab evaluation "${input.description}" is forbidden from reading browser storage or cookies.`);
  }

  const raw = await runAppleScript(
    `tell application "Google Chrome" to execute front window's active tab javascript "${escapeAppleScriptText(buildWrappedActiveTabScript(input.script))}"`,
    input.abortSignal ? { signal: input.abortSignal } : undefined,
  );
  await refreshSnapshot(state);
  return JSON.parse(raw) as T;
};

export const setCurrentChromeFileInputFiles = async (
  state: RuntimeState,
  input: SetFileInputFilesInput,
  refreshSnapshot: RefreshSnapshot,
  sleep: Sleep,
): Promise<BrowserActionResult> => {
  const clickResult = await evaluateActiveTab<{ status: string; message: string }>(
    state,
    {
      description: input.description,
      script: buildFileInputSelectionScript(input.elementRef.selector),
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    },
    refreshSnapshot,
  );

  if (clickResult.status !== "success") {
    return createCurrentChromeBrowserActionResult({
      ok: false,
      message: clickResult.message,
    });
  }

  await activateChrome(input.abortSignal);
  await sleep(350, input.abortSignal);
  await keystrokeBrowserText(input.filePath, input.abortSignal);
  await pressBrowserKey(36, input.abortSignal);
  await sleep(700, input.abortSignal);
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: "approved file selected for located file input",
  });
};

export const waitForDuration = async (
  state: RuntimeState,
  durationMs: number,
  refreshSnapshot: RefreshSnapshot,
  sleep: Sleep,
): Promise<BrowserActionResult> => {
  await sleep(durationMs);
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `waited ${durationMs}ms`,
  });
};

export const closeCurrentChrome = async (
  state: RuntimeState,
  refreshSnapshot: RefreshSnapshot,
): Promise<BrowserActionResult> => {
  await refreshSnapshot(state).catch(() => undefined);
  return createCurrentChromeBrowserActionResult({
    message: "left current Chrome session open for the operator",
  });
};