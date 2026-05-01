import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";
import { createInitialLocalBrowserSessionState } from "./local-browser-session.js";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserTextInputAction,
  BrowserTextInputKey,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserScrollCoordinateSpace,
  BrowserStateSnapshot,
} from "./browser-controller.js";
import { createId } from "../local-runtime/ids.js";
import {
  runSpawn,
} from "./current-chrome-window-control.js";
import {
  activateChrome,
  buildOpenUrlScript,
  clickAt,
  readFrontChromeWindowState,
  runAppleScript,
  scrollAt,
} from "./current-chrome-browser-controller-primitives.js";
import {
  createBrowserActionResult,
  resolveChromeLoginState,
} from "./current-chrome-browser-session-state.js";
import { executeCurrentChromeTextInput } from "./current-chrome-browser-text-input.js";

type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  headlessRequested?: boolean;
};

export class CurrentChromeBrowserController implements BrowserController {
  private snapshot: BrowserStateSnapshot;

  constructor(private readonly options: CurrentChromeBrowserControllerOptions) {
    if (options.headlessRequested === true) {
      throw new Error("Real-platform mode forbids headless browser launch; use the current local Chrome session instead.");
    }

    this.snapshot = {
      ...createInitialLocalBrowserSessionState(options.sessionConfig),
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
    await this.wait(1200);
    await this.refreshSnapshot();
    return this.createActionResult({ message: `opened ${input.url} in current Chrome session` });
  }

  async scroll(input: { targetLabel: string; deltaX: number; deltaY: number; coordinateSpace?: BrowserScrollCoordinateSpace; anchorPoint?: { x: number; y: number }; fallbackUsed?: boolean }): Promise<BrowserActionResult> {
    const geometry = await this.getGeometrySnapshot();
    await activateChrome();
    const coordinateSpace = input.coordinateSpace ?? "browserViewport";
    const anchorPoint = input.anchorPoint ?? {
      x: Math.round(geometry.viewportWidth / 2),
      y: Math.round(geometry.viewportHeight / 2),
    };
    const scrollX = coordinateSpace === "desktopScreen" ? anchorPoint.x : geometry.windowX + anchorPoint.x;
    const scrollY = coordinateSpace === "desktopScreen" ? anchorPoint.y : geometry.windowY + anchorPoint.y;
    if (input.deltaX === 0 && input.deltaY === 0) {
      return this.createActionResult({ message: `skipped zero scroll for ${input.targetLabel}`, ok: false, fallbackUsed: input.fallbackUsed ?? false });
    }
    await scrollAt({
      x: Math.round(scrollX),
      y: Math.round(scrollY),
      deltaX: input.deltaX,
      deltaY: input.deltaY,
    });
    await this.wait(1200);
    return this.createActionResult({ message: `scrolled ${input.targetLabel} dx=${input.deltaX} dy=${input.deltaY}`, fallbackUsed: input.fallbackUsed ?? false });
  }

  async click(input: { targetLabel: string; point: { x: number; y: number }; coordinateSpace?: "browserViewport" | "desktopScreen"; button?: "left" | "right" | "middle"; clickCount?: 1 | 2; fallbackUsed?: boolean }): Promise<BrowserActionResult> {
    const geometry = await this.getGeometrySnapshot();
    await activateChrome();
    const coordinateSpace = input.coordinateSpace ?? "browserViewport";
    const clickX = coordinateSpace === "desktopScreen" ? input.point.x : geometry.windowX + input.point.x;
    const clickY = coordinateSpace === "desktopScreen" ? input.point.y : geometry.windowY + input.point.y;
    await clickAt(Math.round(clickX), Math.round(clickY), input.button ?? "left", input.clickCount ?? 1);
    await this.wait(700);
    return this.createActionResult({ message: `clicked ${input.targetLabel}`, fallbackUsed: input.fallbackUsed ?? false });
  }

  async textInput(input: { targetLabel: string; action: BrowserTextInputAction; text?: string | null; key?: BrowserTextInputKey | null; fallbackUsed?: boolean; abortSignal?: AbortSignal }): Promise<BrowserActionResult> {
    const result = await executeCurrentChromeTextInput(input, () => createId("browser"));
    await this.wait(300);
    return result;
  }

  async screenshotRegion(input: { regionLabel: string; contentLines?: string[]; abortSignal?: AbortSignal }): Promise<BrowserCaptureResult> {
    const geometry = await this.getGeometrySnapshot();
    await mkdir(this.options.screenshotDir, { recursive: true });
    const screenshotPath = path.join(this.options.screenshotDir, `${createId(input.regionLabel)}.png`);
    await activateChrome();
    await runSpawn(
      "screencapture",
      ["-x", "-R", `${Math.round(geometry.windowX)},${Math.round(geometry.windowY)},${Math.round(geometry.viewportWidth)},${Math.round(geometry.viewportHeight)}`, screenshotPath],
      input.abortSignal ? { signal: input.abortSignal } : undefined,
    );
    await this.refreshSnapshot();

    return {
      browserActionId: createId("browser"),
      pageUrl: this.snapshot.currentUrl,
      pageTitle: this.snapshot.currentTitle,
      regionLabel: input.regionLabel,
      regionType: "viewport",
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
      ...(input.contentLines ? { contentLines: input.contentLines } : {}),
      sourceFilePath: screenshotPath,
      createdAt: new Date().toISOString(),
    };
  }

  async wait(durationMs: number): Promise<BrowserActionResult> {
    await new Promise((resolve) => setTimeout(resolve, durationMs));
    await this.refreshSnapshot();
    return this.createActionResult({ message: `waited ${durationMs}ms` });
  }

  async close(): Promise<BrowserActionResult> {
    await this.refreshSnapshot().catch(() => undefined);
    return createBrowserActionResult({ actionId: createId("browser"), message: "left current Chrome session open for the operator", fallbackUsed: false });
  }

  private createActionResult(input: { message: string; ok?: boolean; fallbackUsed?: boolean }): BrowserActionResult {
    return createBrowserActionResult({
      actionId: createId("browser"),
      message: input.message,
      ...(input.ok === undefined ? {} : { ok: input.ok }),
      ...(input.fallbackUsed === undefined ? {} : { fallbackUsed: input.fallbackUsed }),
    });
  }

  private async refreshSnapshot() {
    const state = await readFrontChromeWindowState();
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