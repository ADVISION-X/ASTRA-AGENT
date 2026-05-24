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
  clickAt,
  escapeAppleScriptText,
} from "./current-chrome-browser-controller-primitives.js";
import { runAppleScript, runJxa } from "./current-chrome-window-control.js";
import { captureCurrentChromeScreenshot } from "./current-chrome-browser-screenshot.js";
import { executeCurrentChromeFieldInput } from "./current-chrome-browser-field-input.js";
import { setFileInputFilesWithCurrentChromeCdp } from "./current-chrome-cdp-file-input.js";
import { runNativeFileInputSelection } from "./current-chrome-native-file-input.js";

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
(() => {
  const result = (() => {
${script}
  })();
  return JSON.stringify(result ?? null);
})()
`;

type CloseActiveTabSnapshot = {
  activeUrl: string | null;
  frontTabCount: number;
  windowCount: number;
};

const readCloseActiveTabSnapshot = async (
  abortSignal?: AbortSignal,
): Promise<CloseActiveTabSnapshot> => {
  const output = await runAppleScript(`
tell application "Google Chrome" to activate
tell application "Google Chrome"
  set windowCount to count of windows
  if windowCount = 0 then return "0" & linefeed & "0" & linefeed
  set frontTabCount to count of tabs of front window
  set activeUrl to URL of active tab of front window
  return (windowCount as string) & linefeed & (frontTabCount as string) & linefeed & activeUrl
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
  const [windowCountText = "0", frontTabCountText = "0", activeUrl = ""] = output.split(/\r?\n/);
  return {
    activeUrl: activeUrl.trim() || null,
    frontTabCount: Number(frontTabCountText),
    windowCount: Number(windowCountText),
  };
};

const didCloseActiveTab = (
  before: CloseActiveTabSnapshot,
  after: CloseActiveTabSnapshot,
): boolean => after.windowCount === 0
  || before.windowCount > after.windowCount
  || before.frontTabCount > after.frontTabCount
  || before.activeUrl !== after.activeUrl;


export const textInputCurrentChrome = async (
  state: RuntimeState,
  input: TextInput,
  refreshSnapshot: RefreshSnapshot,
): Promise<BrowserActionResult> => {
  const result = await executeCurrentChromeFieldInput(input, () => createId("browser"));
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
  const cdpResult = await setFileInputFilesWithCurrentChromeCdp({
    currentUrl: state.snapshot.currentUrl,
    selector: input.elementRef.selector,
    filePath: input.filePath,
  });
  if (cdpResult.ok) {
    await refreshSnapshot(state);
    return createCurrentChromeBrowserActionResult({ message: cdpResult.message });
  }
  const nativeFailure = await runNativeFileInputSelection({ evaluateActiveTab, state, input, refreshSnapshot, sleep });
  if (nativeFailure) {
    return createCurrentChromeBrowserActionResult({
      ok: false,
      message: `approved file selection failed; CDP unavailable: ${cdpResult.message}; ${nativeFailure.message}`,
    });
  }
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({ message: `approved file selected for located file input; CDP unavailable: ${cdpResult.message}` });
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

export const closeCurrentChromeActiveTab = async (
  state: RuntimeState,
  input: { reason: string; abortSignal?: AbortSignal },
  refreshSnapshot: RefreshSnapshot,
): Promise<BrowserActionResult> => {
  const before = await readCloseActiveTabSnapshot(input.abortSignal);
  if (before.windowCount === 0 || before.frontTabCount === 0) {
    return createCurrentChromeBrowserActionResult({
      ok: false,
      message: `no active Chrome tab available to close after ${input.reason}`,
    });
  }
  await activateChrome(input.abortSignal);
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
  keystroke "w" using command down
end tell
`, input.abortSignal ? { signal: input.abortSignal } : undefined);
  await runAppleScript("delay 0.2", input.abortSignal ? { signal: input.abortSignal } : undefined);
  const after = await readCloseActiveTabSnapshot(input.abortSignal).catch(() => ({
    activeUrl: null,
    frontTabCount: 0,
    windowCount: 0,
  }));
  await refreshSnapshot(state).catch(() => undefined);
  if (!didCloseActiveTab(before, after)) {
    return createCurrentChromeBrowserActionResult({
      ok: false,
      message: `Command+W did not change Chrome tab state after ${input.reason}`,
    });
  }
  return createCurrentChromeBrowserActionResult({
    message: `closed active Chrome tab with Command+W after ${input.reason}`,
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
