import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";

import type {
  BrowserActionResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserOpenNavigationMode,
  BrowserOpenResult,
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
  runJxa,
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
  selectCurrentChromeNativePickerFiles,
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
  executionAbortSignal: AbortSignal | null;
};

type OpenInput = Parameters<BrowserController["open"]>[0];
type ScrollInput = Parameters<BrowserController["scroll"]>[0];
type ClickInput = Parameters<BrowserController["click"]>[0];
type MoveInput = Parameters<NonNullable<BrowserController["move"]>>[0];
type TextInput = Parameters<BrowserController["textInput"]>[0];
type ScreenshotRegionInput = Parameters<BrowserController["screenshotRegion"]>[0];
type SetFileInputFilesInput = Parameters<BrowserController["setFileInputFiles"]>[0];
type SelectFilesInNativePickerInput = Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0];

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
    executionAbortSignal: null,
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
  abortSignal?: AbortSignal,
): Promise<CurrentChromeWindowState> => {
  const windowState = await readFrontChromeWindowState(abortSignal ?? state.executionAbortSignal ?? undefined);
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

const readViewportMetrics = async (abortSignal?: AbortSignal): Promise<ViewportMetrics> => {
  try {
    const jsSnippet = "JSON.stringify({dpr:window.devicePixelRatio||1,innerWidth:window.innerWidth,innerHeight:window.innerHeight,outerHeight:window.outerHeight})";
    const raw = await runJxa(`
const chrome = Application("Google Chrome");
const chromeWindows = chrome.windows();
if (chromeWindows.length === 0) throw new Error("Google Chrome window is unavailable");
chrome.activate();
chromeWindows[0].activeTab().execute({javascript: ${JSON.stringify(jsSnippet)}});
`, abortSignal ? { signal: abortSignal } : undefined);
    return JSON.parse(raw) as ViewportMetrics;
  } catch (error) {
    if (abortSignal?.aborted) {
      throw abortSignal.reason instanceof Error ? abortSignal.reason : error;
    }
    return { dpr: 1, innerWidth: 0, innerHeight: 0, outerHeight: 0 };
  }
};

const getGeometrySnapshot = async (
  state: RuntimeState,
  abortSignal?: AbortSignal,
): Promise<BrowserGeometrySnapshot> => {
  const signal = abortSignal ?? state.executionAbortSignal ?? undefined;
  const windowState = await refreshSnapshot(state, signal);
  const viewportMetrics = await readViewportMetrics(signal);
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
): Promise<BrowserOpenResult> => {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const reusePolicy = input.reusePolicy ?? "reuse-exact-url";
  const openMode = await runAppleScript(
    buildOpenUrlScript(input.url, reusePolicy),
    input.abortSignal ? { signal: input.abortSignal } : undefined,
  );
  if (openMode === "no_existing_tab") {
    await refreshSnapshot(state, input.abortSignal).catch(() => null);
    return createOpenResult({
      state,
      input,
      startedAt,
      startedAtMs,
      reusePolicy,
      navigationMode: "no_existing_tab",
      ok: false,
      message: "no existing Chrome tab matched requested focus-only URL",
    });
  }
  state.controlledUrl = input.url;
  await refreshSnapshot(state, input.abortSignal);
  return createOpenResult({
    state,
    input,
    startedAt,
    startedAtMs,
    reusePolicy,
    navigationMode: normalizeOpenMode(openMode),
    message: `${openMode || "opened"} ${input.url} in current Chrome session`,
  });
};

const normalizeOpenMode = (value: string): BrowserOpenNavigationMode => {
  const modes: BrowserOpenNavigationMode[] = [
    "focused_existing_tab",
    "focused_existing_same_path_tab",
    "opened_new_window",
    "opened_new_tab",
    "opened_new_host_tab",
    "reused_active_tab",
    "reused_host_tab",
    "no_existing_tab",
  ];
  return modes.includes(value as BrowserOpenNavigationMode) ? value as BrowserOpenNavigationMode : "unknown";
};

const requestedHost = (value: string): string => {
  try {
    return new URL(value).host || "local-file";
  } catch {
    return "unknown";
  }
};

const observedUrlMatchesRequest = (requested: string, observed: string): boolean => {
  try {
    const requestedUrl = new URL(requested);
    const observedUrl = new URL(observed);
    return requestedUrl.protocol === observedUrl.protocol
      && requestedUrl.host === observedUrl.host
      && requestedUrl.pathname === observedUrl.pathname;
  } catch {
    return requested === observed;
  }
};

const createOpenResult = (input: {
  state: RuntimeState;
  input: OpenInput;
  startedAt: string;
  startedAtMs: number;
  reusePolicy: NonNullable<OpenInput["reusePolicy"]>;
  navigationMode: BrowserOpenNavigationMode;
  message: string;
  ok?: boolean;
}): BrowserOpenResult => {
  const observedUrl = input.state.snapshot.currentUrl;
  return {
    ...createCurrentChromeBrowserActionResult({
      message: input.message,
      ...(input.ok === undefined ? {} : { ok: input.ok }),
      ...(input.input.browserActionId ? { actionId: input.input.browserActionId } : {}),
    }),
    actionKind: "open",
    requestedHost: requestedHost(input.input.url),
    reusePolicy: input.reusePolicy,
    navigationMode: input.navigationMode,
    observedUrl,
    observedUrlMatchesRequest: observedUrlMatchesRequest(input.input.url, observedUrl),
    startedAt: input.startedAt,
    durationMs: Math.max(0, Date.now() - input.startedAtMs),
  };
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
  await activateChrome(input.abortSignal);
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
    input.abortSignal,
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
  await activateChrome(input.abortSignal);
  const point = resolveClickDesktopPoint(geometry, input);
  await moveAt(Math.round(point.x), Math.round(point.y), input.abortSignal);
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
    setExecutionAbortSignal: (abortSignal) => {
      state.executionAbortSignal = abortSignal;
    },
    getHealth: () => getHealth(state),
    getSessionState: () => getSessionState(state),
    getGeometrySnapshot: (abortSignal) => getGeometrySnapshot(state, abortSignal),
    open: (input) => openCurrentChrome(state, withExecutionAbortSignal(state, input)),
    scroll: (input) => scrollCurrentChrome(state, withExecutionAbortSignal(state, input)),
    click: (input) => clickCurrentChrome(state, withExecutionAbortSignal(state, input)),
    move: (input) => moveCurrentChrome(state, withExecutionAbortSignal(state, input)),
    clickLocatedDomElement: (input) => clickCurrentChrome(state, {
      targetLabel: input.targetLabel,
      point: input.point,
      coordinateSpace: "desktopScreen",
      button: "left",
      clickCount: 1,
      ...((input.abortSignal ?? state.executionAbortSignal)
        ? { abortSignal: (input.abortSignal ?? state.executionAbortSignal) as AbortSignal }
        : {}),
    }),
    textInput: (input: TextInput) => textInputCurrentChrome(state, withExecutionAbortSignal(state, input), refreshSnapshot),
    screenshotRegion: (input: ScreenshotRegionInput) => screenshotCurrentChromeRegion(state, withExecutionAbortSignal(state, input), getGeometrySnapshot),
    evaluateActiveTab: <T>(input: EvaluateActiveTabInput) => evaluateActiveTab<T>(state, withExecutionAbortSignal(state, input), refreshSnapshot),
    setFileInputFiles: (input: SetFileInputFilesInput) => setCurrentChromeFileInputFiles(state, withExecutionAbortSignal(state, input), refreshSnapshot, sleep),
    selectFilesInNativePicker: (input: SelectFilesInNativePickerInput) =>
      selectCurrentChromeNativePickerFiles(state, withExecutionAbortSignal(state, input), refreshSnapshot),
    wait: (durationMs, abortSignal) => waitForDuration(state, durationMs, refreshSnapshot, sleep, abortSignal ?? state.executionAbortSignal ?? undefined),
    closeActiveTab: (input) => closeCurrentChromeActiveTab(state, withExecutionAbortSignal(state, input), refreshSnapshot),
    close: () => closeCurrentChrome(state, refreshSnapshot),
  };
};

function withExecutionAbortSignal<T extends { abortSignal?: AbortSignal }>(state: RuntimeState, input: T): T {
  const abortSignal = input.abortSignal ?? state.executionAbortSignal;
  return abortSignal ? { ...input, abortSignal } : input;
}

export type { RuntimeState };
