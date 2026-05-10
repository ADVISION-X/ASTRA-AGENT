import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";
import { createInitialLocalBrowserSessionState } from "./local-browser-session.js";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserClickCoordinateSpace,
  BrowserTextInputAction,
  BrowserTextInputKey,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserScrollCoordinateSpace,
  BrowserStateSnapshot,
} from "./browser-controller.js";
import { createId } from "../local-runtime/ids.js";
import {
  activateChrome,
  buildOpenUrlScript,
  clickAt,
  pressBrowserKey,
  readFrontChromeWindowState,
  runAppleScript,
  scrollAt,
} from "./current-chrome-browser-controller-primitives.js";
import {
  resolveChromeLoginState,
} from "./current-chrome-browser-session-state.js";
import { createCurrentChromeBrowserActionResult } from "./current-chrome-browser-action-result.js";
import { emitCurrentChromeMouseClickProbe } from "./current-chrome-browser-click-probe.js";
import {
  createZeroScrollMessage,
  resolveCurrentChromeScrollPlan,
  runOptionalArrowDownAssist,
} from "./current-chrome-browser-scroll-support.js";
import { captureCurrentChromeScreenshot } from "./current-chrome-browser-screenshot.js";
import { executeCurrentChromeTextInput } from "./current-chrome-browser-text-input.js";

type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  headlessRequested?: boolean;
};

export class CurrentChromeBrowserController implements BrowserController {
  private snapshot: BrowserStateSnapshot;
  private lastWindowState: Awaited<ReturnType<typeof readFrontChromeWindowState>> | null = null;

  constructor(private readonly options: CurrentChromeBrowserControllerOptions) {
    if (options.headlessRequested === true) {
      throw new Error("Real-platform mode forbids headless browser launch; use the current local Chrome session instead.");
    }

    this.snapshot = {
      ...createInitialLocalBrowserSessionState(options.sessionConfig),
      profileStatus: "profile_ready",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "current local Chrome session reused as the governed real-platform browser",
      open: false,
      currentUrl: "about:blank",
      currentTitle: "Google Chrome",
      browserExecutable: options.sessionConfig.chromeExecutablePath,
    };
  }

  getHealth(): { ok: boolean; detail: string } {
    return {
      ok: true,
      detail: this.snapshot.open
        ? `current Chrome session active on ${this.snapshot.currentUrl}`
        : `current Chrome session ready for ${this.snapshot.browserProfileRef}`,
    };
  }

  getSessionState(): BrowserStateSnapshot {
    return { ...this.snapshot };
  }

  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    const state = await this.refreshSnapshot();
    return {
      windowX: state.windowX,
      windowY: state.windowY,
      viewportWidth: state.width,
      viewportHeight: state.height,
      screenshotWidth: state.width,
      screenshotHeight: state.height,
      scaleFactor: 1,
      currentUrl: state.currentUrl,
      pageTitle: state.currentTitle,
      visibleContentBounds: {
        x: 0,
        y: 0,
        width: state.width,
        height: state.height,
      },
      capturedAt: new Date().toISOString(),
    };
  }

  async open(input: { url: string; title: string }): Promise<BrowserActionResult> {
    await runAppleScript(buildOpenUrlScript(input.url));
    await this.refreshSnapshot();
    return createCurrentChromeBrowserActionResult({ message: `opened ${input.url} in current Chrome session` });
  }

  async scroll(input: { targetLabel: string; deltaX: number; deltaY: number; coordinateSpace?: BrowserScrollCoordinateSpace; anchorPoint?: { x: number; y: number }; fallbackUsed?: boolean; abortSignal?: AbortSignal }): Promise<BrowserActionResult> {
    const geometry = this.lastWindowState ?? await this.refreshSnapshot();
    const scrollPlan = resolveCurrentChromeScrollPlan(input, geometry);
    if (!scrollPlan) {
      return createCurrentChromeBrowserActionResult({
        message: createZeroScrollMessage(input.targetLabel),
        ok: false,
        fallbackUsed: input.fallbackUsed ?? false,
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
    const auxiliaryKeyMessage = await runOptionalArrowDownAssist({
      required: scrollPlan.requiresArrowDownAssist,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });

    await this.refreshSnapshot();
    return createCurrentChromeBrowserActionResult({
      message: `scrolled ${input.targetLabel} dx=${input.deltaX} dy=${input.deltaY}${auxiliaryKeyMessage}; browser scroll settle observed`,
      fallbackUsed: input.fallbackUsed ?? false,
    });
  }

  async click(input: { targetLabel: string; point: { x: number; y: number }; coordinateSpace?: BrowserClickCoordinateSpace; button?: "left" | "right" | "middle"; clickCount?: 1 | 2; fallbackUsed?: boolean }): Promise<BrowserActionResult> {
    const geometry = await this.getGeometrySnapshot();
    await activateChrome();
    const coordinateSpace = input.coordinateSpace ?? "browserViewport";
    const clickX = coordinateSpace === "desktopScreen" ? input.point.x : geometry.windowX + input.point.x;
    const clickY = coordinateSpace === "desktopScreen" ? input.point.y : geometry.windowY + input.point.y;
    await emitCurrentChromeMouseClickProbe({
      screenshotDir: this.options.screenshotDir,
      targetLabel: input.targetLabel,
      coordinateSpace,
      inputPoint: input.point,
      computedDesktopPoint: {
        x: Math.round(clickX),
        y: Math.round(clickY),
      },
      geometry: {
        windowX: geometry.windowX,
        windowY: geometry.windowY,
        viewportWidth: geometry.viewportWidth,
        viewportHeight: geometry.viewportHeight,
        visibleContentBounds: geometry.visibleContentBounds,
      },
    });
    await clickAt(Math.round(clickX), Math.round(clickY), input.button ?? "left", input.clickCount ?? 1);
    await this.refreshSnapshot();
    return createCurrentChromeBrowserActionResult({ message: `clicked ${input.targetLabel}`, fallbackUsed: input.fallbackUsed ?? false });
  }

  async textInput(input: { targetLabel: string; action: BrowserTextInputAction; text?: string | null; key?: BrowserTextInputKey | null; fallbackUsed?: boolean; abortSignal?: AbortSignal }): Promise<BrowserActionResult> {
    const result = await executeCurrentChromeTextInput(input, () => createId("browser"));
    await this.refreshSnapshot();
    return result;
  }

  async screenshotRegion(input: { regionLabel: string; contentLines?: string[]; captureProfile?: "default" | "observation_lightweight"; abortSignal?: AbortSignal }): Promise<BrowserCaptureResult> {
    const geometry = await this.getGeometrySnapshot();
    const screenshot = await captureCurrentChromeScreenshot({
      screenshotDir: this.options.screenshotDir,
      geometry,
      regionLabel: input.regionLabel,
      allowFullscreenFallback: input.captureProfile !== "observation_lightweight",
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    await this.refreshSnapshot();

    return {
      browserActionId: createId("browser"),
      pageUrl: this.snapshot.currentUrl,
      pageTitle: this.snapshot.currentTitle,
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
  }

  async wait(durationMs: number): Promise<BrowserActionResult> {
    await this.sleep(durationMs);
    await this.refreshSnapshot();
    return createCurrentChromeBrowserActionResult({ message: `waited ${durationMs}ms` });
  }

  async close(): Promise<BrowserActionResult> {
    await this.refreshSnapshot().catch(() => undefined);
    return createCurrentChromeBrowserActionResult({ message: "left current Chrome session open for the operator", fallbackUsed: false });
  }

  private async sleep(durationMs: number, abortSignal?: AbortSignal): Promise<void> {
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
  }

  private async refreshSnapshot() {
    const state = await readFrontChromeWindowState();
    this.lastWindowState = state;
    const loginState = resolveChromeLoginState(state.currentUrl, state.currentTitle);
    this.snapshot = {
      ...this.snapshot,
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "current local Chrome session reused as the governed real-platform browser",
      open: true,
      currentUrl: state.currentUrl,
      currentTitle: state.currentTitle,
      loginState,
      profileStatus: loginState === "logged_in" ? "logged_in" : loginState === "login_required" ? "login_required" : "profile_ready",
      loginRequiredReason: loginState === "login_required" ? "operator login required inside current local Chrome session" : null,
      reviewRequiredReason: loginState === "review_required" ? "browser challenge or safety review required" : null,
      lastLoginCheckAt: new Date().toISOString(),
    };
    return state;
  }
}
