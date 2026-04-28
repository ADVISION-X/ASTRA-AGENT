import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../../lib/browser/browser-controller.js";
import type { BrowserLoginState } from "../../../types/local-browser-session.js";

type FakeBrowserControllerInput = {
  currentUrlAfterOpen: string;
  pageTitleAfterOpen?: string;
  loginStateAfterOpen?: BrowserLoginState;
  openOk?: boolean;
  openError?: string;
};

function createInitialBrowserState(): BrowserStateSnapshot {
  return {
    browserMode: "real_chrome_persistent",
    browserProfileRef: "test:profile",
    browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    profileStatus: "profile_ready",
    profileDirectory: "Default",
    profileProvisioning: "operator_supplied",
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "test profile",
    loginState: "unknown",
    currentUrl: "about:blank",
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
    open: false,
    currentTitle: "about:blank",
    browserExecutable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };
}

function buildActionResult(message: string, ok = true): BrowserActionResult {
  return {
    browserActionId: `browser_${Math.random().toString(16).slice(2)}`,
    ok,
    message,
    createdAt: new Date().toISOString(),
    fallbackUsed: false,
  };
}

function buildGeometrySnapshot(state: BrowserStateSnapshot): BrowserGeometrySnapshot {
  return {
    windowX: 0,
    windowY: 0,
    viewportWidth: 1280,
    viewportHeight: 720,
    screenshotWidth: 1280,
    screenshotHeight: 720,
    scaleFactor: 1,
    currentUrl: state.currentUrl,
    pageTitle: state.currentTitle,
    visibleContentBounds: {
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
    },
    capturedAt: new Date().toISOString(),
  };
}

function applyOpenState(
  state: BrowserStateSnapshot,
  input: FakeBrowserControllerInput,
  openInput: { url: string; title: string },
): void {
  state.open = true;
  state.currentUrl = input.currentUrlAfterOpen;
  state.currentTitle = input.pageTitleAfterOpen ?? openInput.title;
  state.loginState = input.loginStateAfterOpen ?? "logged_in";
  state.lastLoginCheckAt = new Date().toISOString();
  state.loginRequiredReason = state.loginState === "login_required" ? "test login wall" : null;
  state.reviewRequiredReason = state.loginState === "review_required" ? "test review wall" : null;
}

export function createFakeBrowserController(
  input: FakeBrowserControllerInput,
): BrowserController {
  const state = createInitialBrowserState();

  return {
    getHealth() {
      return { ok: true, detail: "fake browser controller" };
    },
    getSessionState() {
      return { ...state };
    },
    async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
      return buildGeometrySnapshot(state);
    },
    async open(inputValue: { url: string; title: string }): Promise<BrowserActionResult> {
      if (input.openError) {
        throw new Error(input.openError);
      }

      applyOpenState(state, input, inputValue);

      return buildActionResult(`opened ${inputValue.url}`, input.openOk ?? true);
    },
    async scroll(): Promise<BrowserActionResult> {
      return buildActionResult("scroll noop");
    },
    async click(): Promise<BrowserActionResult> {
      return buildActionResult("click noop");
    },
    async screenshotRegion(inputValue: { regionLabel: string }): Promise<BrowserCaptureResult> {
      return {
        browserActionId: `capture_${Math.random().toString(16).slice(2)}`,
        pageUrl: state.currentUrl,
        pageTitle: state.currentTitle,
        regionLabel: inputValue.regionLabel,
        regionType: "viewport",
        width: 1280,
        height: 720,
        createdAt: new Date().toISOString(),
      };
    },
    async wait(durationMs: number): Promise<BrowserActionResult> {
      return buildActionResult(`waited ${durationMs}`);
    },
    async close(): Promise<BrowserActionResult> {
      return buildActionResult("closed");
    },
  };
}

export function assertCapabilityCheck(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}