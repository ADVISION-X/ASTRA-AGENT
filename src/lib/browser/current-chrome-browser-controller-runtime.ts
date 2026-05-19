import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";

import type {
  BrowserActionResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "./browser-controller.js";
import { createInitialLocalBrowserSessionState } from "./local-browser-session.js";
import {
  activateChrome,
  clickAt,
  scrollAt,
} from "./current-chrome-browser-controller-primitives.js";
import {
  buildOpenUrlScript,
  readFrontChromeWindowState,
  runAppleScript,
} from "./current-chrome-window-control.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import { emitCurrentChromeMouseClickProbe } from "./current-chrome-browser-click-probe.js";
import {
  createZeroScrollMessage,
  resolveCurrentChromeScrollPlan,
} from "./current-chrome-browser-scroll-support.js";
import {
  closeCurrentChrome,
  evaluateActiveTab,
  type EvaluateActiveTabInput,
  screenshotCurrentChromeRegion,
  setCurrentChromeFileInputFiles,
  textInputCurrentChrome,
  waitForDuration,
} from "./current-chrome-browser-controller-execution.js";

export type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  headlessRequested?: boolean;
};

type CurrentChromeWindowState = Awaited<ReturnType<typeof readFrontChromeWindowState>>;

type RuntimeState = {
  options: CurrentChromeBrowserControllerOptions;
  snapshot: BrowserStateSnapshot;
  lastWindowState: CurrentChromeWindowState | null;
};

type OpenInput = Parameters<BrowserController["open"]>[0];
type ScrollInput = Parameters<BrowserController["scroll"]>[0];
type ClickInput = Parameters<BrowserController["click"]>[0];
type TextInput = Parameters<BrowserController["textInput"]>[0];
type ScreenshotRegionInput = Parameters<BrowserController["screenshotRegion"]>[0];
type SetFileInputFilesInput = Parameters<BrowserController["setFileInputFiles"]>[0];

const createRuntimeState = (
  options: CurrentChromeBrowserControllerOptions,
): RuntimeState => {
  if (options.headlessRequested === true) {
    throw new Error("Real-platform mode forbids headless browser launch; use the current local Chrome session instead.");
  }

  return {
    options,
    snapshot: {
      ...createInitialLocalBrowserSessionState(options.sessionConfig),
      profileStatus: "profile_ready",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "current local Chrome session reused as the governed real-platform browser",
      open: false,
      currentUrl: "about:blank",
      currentTitle: "Google Chrome",
      browserExecutable: options.sessionConfig.chromeExecutablePath,
    },
    lastWindowState: null,
  };
};

const getHealth = (state: RuntimeState): { ok: boolean; detail: string } => ({
  ok: true,
  detail: state.snapshot.open
    ? `current Chrome session active on ${state.snapshot.currentUrl}`
    : `current Chrome session ready for ${state.snapshot.browserProfileRef}`,
});

const getSessionState = (state: RuntimeState): BrowserStateSnapshot => ({
  ...state.snapshot,
});

const sleep = async (
  durationMs: number,
  abortSignal?: AbortSignal,
): Promise<void> => {
  if (abortSignal?.aborted) {
    throw new Error("browser wait aborted before observable condition polling.");
  }
  await new Promise<void>((resolve, reject) => {
    const handle = setTimeout(resolve, durationMs);
    const abortHandler = () => {
      clearTimeout(handle);
      reject(new Error("browser wait aborted during observable condition polling."));
    };
    abortSignal?.addEventListener("abort", abortHandler, { once: true });
  });
};

const refreshSnapshot = async (
  state: RuntimeState,
): Promise<CurrentChromeWindowState> => {
  const windowState = await readFrontChromeWindowState();
  state.lastWindowState = windowState;
  state.snapshot = {
    ...state.snapshot,
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "current local Chrome session reused as the governed real-platform browser",
    open: true,
    currentUrl: windowState.currentUrl,
    currentTitle: windowState.currentTitle,
    loginState: "unknown",
    profileStatus: "profile_ready",
    loginRequiredReason: null,
    reviewRequiredReason: null,
    lastLoginCheckAt: new Date().toISOString(),
  };
  return windowState;
};

const readScaleFactor = async (): Promise<number> => {
  try {
    const jsSnippet = "JSON.stringify({dpr:window.devicePixelRatio||1})";
    const raw = await runAppleScript(
      `tell application "Google Chrome" to execute front window's active tab javascript "${jsSnippet}"`,
    );
    const viewport = JSON.parse(raw) as { dpr: number };
    return viewport.dpr;
  } catch {
    return 1;
  }
};

const getGeometrySnapshot = async (
  state: RuntimeState,
): Promise<BrowserGeometrySnapshot> => {
  const windowState = await refreshSnapshot(state);
  const scaleFactor = await readScaleFactor();
  const visibleContentBounds = {
    x: 0,
    y: 0,
    width: windowState.width,
    height: windowState.height,
  };

  return {
    windowX: windowState.windowX,
    windowY: windowState.windowY,
    viewportWidth: visibleContentBounds.width,
    viewportHeight: visibleContentBounds.height,
    screenshotWidth: Math.round(visibleContentBounds.width * scaleFactor),
    screenshotHeight: Math.round(visibleContentBounds.height * scaleFactor),
    scaleFactor,
    currentUrl: windowState.currentUrl,
    pageTitle: windowState.currentTitle,
    visibleContentBounds,
    capturedAt: new Date().toISOString(),
  };
};

const openCurrentChrome = async (
  state: RuntimeState,
  input: OpenInput,
): Promise<BrowserActionResult> => {
  await runAppleScript(buildOpenUrlScript(input.url));
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `opened ${input.url} in current Chrome session`,
  });
};

const scrollCurrentChrome = async (
  state: RuntimeState,
  input: ScrollInput,
): Promise<BrowserActionResult> => {
  const geometry = state.lastWindowState ?? await refreshSnapshot(state);
  const scrollPlan = resolveCurrentChromeScrollPlan(input, geometry);
  if (!scrollPlan) {
    return createCurrentChromeBrowserActionResult({
      message: createZeroScrollMessage(input.targetLabel),
      ok: false,
    });
  }

  await activateChrome(input.abortSignal);
  await scrollAt({
    x: Math.round(scrollPlan.scrollX),
    y: Math.round(scrollPlan.scrollY),
    deltaX: input.deltaX,
    deltaY: input.deltaY,
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });

  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `scrolled ${input.targetLabel} dx=${input.deltaX} dy=${input.deltaY}; browser scroll settle observed`,
  });
};

const resolveClickDesktopPoint = (
  geometry: BrowserGeometrySnapshot,
  input: ClickInput,
) => {
  const coordinateSpace = input.coordinateSpace ?? "browserViewport";
  return {
    coordinateSpace,
    x: coordinateSpace === "desktopScreen"
      ? input.point.x
      : geometry.windowX + geometry.visibleContentBounds.x + (input.point.x / geometry.scaleFactor),
    y: coordinateSpace === "desktopScreen"
      ? input.point.y
      : geometry.windowY + geometry.visibleContentBounds.y + (input.point.y / geometry.scaleFactor),
  };
};

const buildClickProbeGeometry = (geometry: BrowserGeometrySnapshot) => ({
  windowX: geometry.windowX,
  windowY: geometry.windowY,
  viewportWidth: geometry.viewportWidth,
  viewportHeight: geometry.viewportHeight,
  visibleContentBounds: geometry.visibleContentBounds,
});

const clickCurrentChrome = async (
  state: RuntimeState,
  input: ClickInput,
): Promise<BrowserActionResult> => {
  const geometry = await getGeometrySnapshot(state);
  await activateChrome();
  const clickPoint = resolveClickDesktopPoint(geometry, input);

  await emitCurrentChromeMouseClickProbe({
    screenshotDir: state.options.screenshotDir,
    targetLabel: input.targetLabel,
    coordinateSpace: clickPoint.coordinateSpace,
    inputPoint: input.point,
    computedDesktopPoint: {
      x: Math.round(clickPoint.x),
      y: Math.round(clickPoint.y),
    },
    geometry: buildClickProbeGeometry(geometry),
  });

  await clickAt(
    Math.round(clickPoint.x),
    Math.round(clickPoint.y),
    input.button ?? "left",
    input.clickCount ?? 1,
  );
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `clicked ${input.targetLabel}`,
  });
};

export const createCurrentChromeBrowserControllerRuntime = (
  options: CurrentChromeBrowserControllerOptions,
): BrowserController => {
  const state = createRuntimeState(options);
  return {
    getHealth: () => getHealth(state),
    getSessionState: () => getSessionState(state),
    getGeometrySnapshot: () => getGeometrySnapshot(state),
    open: (input) => openCurrentChrome(state, input),
    scroll: (input) => scrollCurrentChrome(state, input),
    click: (input) => clickCurrentChrome(state, input),
    textInput: (input: TextInput) => textInputCurrentChrome(state, input, refreshSnapshot),
    screenshotRegion: (input: ScreenshotRegionInput) => screenshotCurrentChromeRegion(state, input, getGeometrySnapshot, refreshSnapshot),
    evaluateActiveTab: <T>(input: EvaluateActiveTabInput) => evaluateActiveTab<T>(state, input, refreshSnapshot),
    setFileInputFiles: (input: SetFileInputFilesInput) => setCurrentChromeFileInputFiles(state, input, refreshSnapshot, sleep),
    wait: (durationMs) => waitForDuration(state, durationMs, refreshSnapshot, sleep),
    close: () => closeCurrentChrome(state, refreshSnapshot),
  };
};

export type { RuntimeState };