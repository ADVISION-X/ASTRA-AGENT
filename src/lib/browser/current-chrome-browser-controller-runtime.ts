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
  moveAt,
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
  closeCurrentChromeActiveTab,
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
  controlledUrl: string | null;
};

type OpenInput = Parameters<BrowserController["open"]>[0];
type ScrollInput = Parameters<BrowserController["scroll"]>[0];
type ClickInput = Parameters<BrowserController["click"]>[0];
type MoveInput = Parameters<NonNullable<BrowserController["move"]>>[0];
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
    controlledUrl: null,
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
  fallbackUrl?: string,
): Promise<CurrentChromeWindowState> => {
  const windowState = await readFrontChromeWindowState(fallbackUrl ?? state.snapshot.currentUrl);
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

type ViewportMetrics = {
  dpr: number;
  innerWidth: number;
  innerHeight: number;
  outerHeight: number;
};

const readViewportMetrics = async (): Promise<ViewportMetrics> => {
  try {
    const jsSnippet = "JSON.stringify({dpr:window.devicePixelRatio||1,innerWidth:window.innerWidth,innerHeight:window.innerHeight,outerHeight:window.outerHeight})";
    const raw = await runAppleScript(
      `tell application "Google Chrome" to execute front window's active tab javascript "${jsSnippet}"`,
    );
    return JSON.parse(raw) as ViewportMetrics;
  } catch {
    return { dpr: 1, innerWidth: 0, innerHeight: 0, outerHeight: 0 };
  }
};

const getGeometrySnapshot = async (
  state: RuntimeState,
): Promise<BrowserGeometrySnapshot> => {
  const windowState = await refreshSnapshot(state);
  const viewportMetrics = await readViewportMetrics();
  const viewportWidth = viewportMetrics.innerWidth > 0 ? viewportMetrics.innerWidth : windowState.width;
  const viewportHeight = viewportMetrics.innerHeight > 0 ? viewportMetrics.innerHeight : windowState.height;
  const browserChromeTopInset = Math.max(0, windowState.height - viewportHeight);
  const visibleContentBounds = {
    x: 0,
    y: browserChromeTopInset,
    width: viewportWidth,
    height: viewportHeight,
  };

  return {
    windowX: windowState.windowX,
    windowY: windowState.windowY,
    viewportWidth,
    viewportHeight,
    screenshotWidth: Math.round(viewportWidth * viewportMetrics.dpr),
    screenshotHeight: Math.round(viewportHeight * viewportMetrics.dpr),
    scaleFactor: viewportMetrics.dpr,
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
  const openMode = await runAppleScript(buildOpenUrlScript(input.url, input.reusePolicy ?? "reuse-exact-url"));
  if (openMode === "no_existing_tab") {
    await refreshSnapshot(state).catch(() => null);
    return createCurrentChromeBrowserActionResult({
      ok: false,
      message: "no existing Chrome tab matched requested focus-only URL",
    });
  }
  state.controlledUrl = input.url;
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `${openMode || "opened"} ${input.url} in current Chrome session`,
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
      : geometry.windowX + geometry.visibleContentBounds.x + input.point.x,
    y: coordinateSpace === "desktopScreen"
      ? input.point.y
      : geometry.windowY + geometry.visibleContentBounds.y + input.point.y,
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

const moveCurrentChrome = async (
  state: RuntimeState,
  input: MoveInput,
): Promise<BrowserActionResult> => {
  const geometry = await getGeometrySnapshot(state);
  await activateChrome();
  const point = resolveClickDesktopPoint(geometry, input);
  await moveAt(Math.round(point.x), Math.round(point.y));
  await refreshSnapshot(state);
  return createCurrentChromeBrowserActionResult({
    message: `moved mouse to ${input.targetLabel}`,
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
    move: (input) => moveCurrentChrome(state, input),
    clickLocatedDomElement: (input) => clickCurrentChrome(state, {
      targetLabel: input.targetLabel,
      point: input.point,
      coordinateSpace: "desktopScreen",
      button: "left",
      clickCount: 1,
    }),
    textInput: (input: TextInput) => textInputCurrentChrome(state, input, refreshSnapshot),
    screenshotRegion: (input: ScreenshotRegionInput) => screenshotCurrentChromeRegion(state, input, getGeometrySnapshot, refreshSnapshot),
    evaluateActiveTab: <T>(input: EvaluateActiveTabInput) => evaluateActiveTab<T>(state, input, refreshSnapshot),
    setFileInputFiles: (input: SetFileInputFilesInput) => setCurrentChromeFileInputFiles(state, input, refreshSnapshot, sleep),
    wait: (durationMs) => waitForDuration(state, durationMs, refreshSnapshot, sleep),
    closeActiveTab: (input) => closeCurrentChromeActiveTab(state, input, refreshSnapshot),
    close: () => closeCurrentChrome(state, refreshSnapshot),
  };
};

export type { RuntimeState };
