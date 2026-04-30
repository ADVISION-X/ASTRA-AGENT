import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { LocalBrowserSessionConfig } from "../../types/local-browser-session.js";
import { createInitialLocalBrowserSessionState } from "./local-browser-session.js";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserScrollCoordinateSpace,
  BrowserStateSnapshot,
  BrowserTextInputAction,
  BrowserTextInputKey,
} from "./browser-controller.js";
import { createId } from "../local-runtime/ids.js";
import type { ChromeWindowState } from "./current-chrome-window-control.js";
import {
  buildOpenUrlScript as buildCurrentChromeOpenUrlScript,
  readFrontChromeWindowState as readCurrentChromeWindowState,
  runAppleScript as runCurrentChromeAppleScript,
  runJxa as runCurrentChromeJxa,
  runSpawn,
} from "./current-chrome-window-control.js";

type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  headlessRequested?: boolean;
};

const LOGIN_URL_TOKENS = ["login", "signin", "signup"];
const LOGIN_TITLE_TOKENS = ["log in", "sign in", "注册", "登录"];
const REVIEW_TOKENS = ["captcha", "challenge", "verify", "safety"];

const containsToken = (value: string, tokens: string[]): boolean => tokens.some((token) => value.includes(token));
const buildOpenUrlScript = (url: string): string => buildCurrentChromeOpenUrlScript(url);
const runAppleScript = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runCurrentChromeAppleScript(script, options);
const runJxa = async (script: string, options?: { signal?: AbortSignal }): Promise<string> => runCurrentChromeJxa(script, options);

const activateChrome = async (): Promise<void> => { await runAppleScript('tell application "Google Chrome" to activate'); };

const escapeAppleScriptText = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

const readFrontChromeWindowState = async (): Promise<ChromeWindowState> => readCurrentChromeWindowState();

const clickAt = async (x: number, y: number, button: "left" | "right" | "middle", clickCount: 1 | 2): Promise<void> => {
  const buttonCode = button === "right"
    ? "$.kCGMouseButtonRight"
    : button === "middle"
      ? "$.kCGMouseButtonCenter"
      : "$.kCGMouseButtonLeft";
  const downType = button === "right"
    ? "$.kCGEventRightMouseDown"
    : button === "middle"
      ? "$.kCGEventOtherMouseDown"
      : "$.kCGEventLeftMouseDown";
  const upType = button === "right"
    ? "$.kCGEventRightMouseUp"
    : button === "middle"
      ? "$.kCGEventOtherMouseUp"
      : "$.kCGEventLeftMouseUp";
  const buttonField = button === "middle"
    ? "$.CGEventSetIntegerValueField(event, $.kCGMouseEventButtonNumber, 2);"
    : "";
  await runJxa(`
ObjC.import('ApplicationServices');
// macOS CGEvent mouse path marker: $.kCGEventLeftMouseDown / $.kCGEventLeftMouseUp
function post(type, x, y) {
  const point = $.CGPointMake(x, y);
  const event = $.CGEventCreateMouseEvent(null, type, point, ${buttonCode});
  ${buttonField}
  $.CGEventPost($.kCGHIDEventTap, event);
}
post($.kCGEventMouseMoved, ${x}, ${y});
for (let count = 0; count < ${clickCount}; count += 1) {
  delay(0.02);
  post(${downType}, ${x}, ${y});
  delay(0.02);
  post(${upType}, ${x}, ${y});
}
`);
};

const pressBrowserKey = async (keyCode: number, abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    key code ${keyCode}
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const keystrokeBrowserText = async (text: string, abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    keystroke "${escapeAppleScriptText(text)}"
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const selectAllBrowserText = async (abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    keystroke "a" using command down
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const pasteBrowserText = async (abortSignal?: AbortSignal): Promise<void> => {
  await runAppleScript(`
tell application "Google Chrome" to activate
tell application "System Events"
    keystroke "v" using command down
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
};

const BROWSER_TEXT_INPUT_KEY_CODES: Record<BrowserTextInputKey, number> = {
  Enter: 36,
  Tab: 48,
  Escape: 53,
  Backspace: 51,
  Delete: 117,
  ArrowUp: 126,
  ArrowDown: 125,
  ArrowLeft: 123,
  ArrowRight: 124,
};

const pressNamedBrowserKey = async (key: BrowserTextInputKey, abortSignal?: AbortSignal): Promise<void> => {
  await pressBrowserKey(BROWSER_TEXT_INPUT_KEY_CODES[key], abortSignal);
};

const scrollAt = async (x: number, y: number, deltaX: number, deltaY: number): Promise<void> => {
  await runJxa(`
ObjC.import('ApplicationServices');
const point = $.CGPointMake(${x}, ${y});
const moveEvent = $.CGEventCreateMouseEvent(null, $.kCGEventMouseMoved, point, $.kCGMouseButtonLeft);
$.CGEventPost($.kCGHIDEventTap, moveEvent);
delay(0.02);
const scrollEvent = $.CGEventCreateScrollWheelEvent(null, $.kCGScrollEventUnitPixel, 2, ${Math.round(deltaY)}, ${Math.round(deltaX)});
$.CGEventPost($.kCGHIDEventTap, scrollEvent);
`);
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
    await scrollAt(Math.round(scrollX), Math.round(scrollY), input.deltaX, input.deltaY);
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
    await activateChrome();

    if ((input.action === "type-text" || input.action === "replace-input") && (!input.text || input.text.length === 0)) {
      return this.createActionResult({
        ok: false,
        message: `missing text for ${input.action} on ${input.targetLabel}`,
        fallbackUsed: input.fallbackUsed ?? false,
      });
    }

    if ((input.action === "press-key" || input.action === "commit-input") && !input.key) {
      return this.createActionResult({
        ok: false,
        message: `missing key for ${input.action} on ${input.targetLabel}`,
        fallbackUsed: input.fallbackUsed ?? false,
      });
    }

    switch (input.action) {
      case "type-text":
        await keystrokeBrowserText(input.text ?? "", input.abortSignal);
        break;
      case "paste-text":
        await pasteBrowserText(input.abortSignal);
        break;
      case "clear-input":
        await selectAllBrowserText(input.abortSignal);
        await pressNamedBrowserKey("Backspace", input.abortSignal);
        break;
      case "replace-input":
        await selectAllBrowserText(input.abortSignal);
        await pressNamedBrowserKey("Backspace", input.abortSignal);
        await keystrokeBrowserText(input.text ?? "", input.abortSignal);
        break;
      case "press-key":
        await pressNamedBrowserKey(input.key ?? "Enter", input.abortSignal);
        break;
      case "commit-input":
        await pressNamedBrowserKey(input.key ?? "Enter", input.abortSignal);
        break;
    }

    await this.wait(300);
    return this.createActionResult({
      message: `${input.action} executed for ${input.targetLabel}`,
      fallbackUsed: input.fallbackUsed ?? false,
    });
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
    return this.createActionResult({ message: "left current Chrome session open for the operator", fallbackUsed: false });
  }

  private async refreshSnapshot(): Promise<ChromeWindowState> {
    const state = await readFrontChromeWindowState();
    const loginState = this.resolveLoginState(state.currentUrl, state.currentTitle);
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

  private resolveLoginState(currentUrl: string, currentTitle: string): BrowserStateSnapshot["loginState"] {
    const normalizedUrl = currentUrl.toLowerCase();
    const normalizedTitle = currentTitle.toLowerCase();
    if (normalizedUrl === "about:blank") {
      return "unknown";
    }
    if (containsToken(normalizedUrl, REVIEW_TOKENS) || containsToken(normalizedTitle, REVIEW_TOKENS)) {
      return "review_required";
    }
    if (containsToken(normalizedUrl, LOGIN_URL_TOKENS) || containsToken(normalizedTitle, LOGIN_TITLE_TOKENS)) {
      return "login_required";
    }
    return "logged_in";
  }

  private createActionResult(input: { message: string; fallbackUsed?: boolean; ok?: boolean }): BrowserActionResult {
    return {
      browserActionId: createId("browser"),
      ok: input.ok ?? true,
      message: input.message,
      createdAt: new Date().toISOString(),
      fallbackUsed: input.fallbackUsed ?? false,
    };
  }
}