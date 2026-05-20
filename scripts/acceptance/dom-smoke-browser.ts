import { join } from "node:path";
import type { Page } from "playwright";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../src/lib/browser/browser-controller.js";

function now(): string {
  return new Date().toISOString();
}

function action(message: string, ok = true): BrowserActionResult {
  return { browserActionId: `smoke:${Date.now()}`, ok, message, createdAt: now() };
}

type SmokeOpenInput = { url: string; title: string };
type SmokeClickInput = {
  targetLabel: string;
  point: { x: number; y: number };
  coordinateSpace?: "browserViewport" | "desktopScreen";
  button?: "left" | "right" | "middle";
  clickCount?: 1 | 2;
};
type SmokeTextInput = {
  targetLabel: string;
  action: "type-text" | "clear-input" | "press-key";
  text?: string | null;
  key?: "Enter" | "Tab" | "Escape" | "Backspace" | "Delete" | "L" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | null;
};
type SmokeFileInput = {
  elementRef: { selector: string; targetKind: "file-input" };
  filePath: string;
  description: string;
};

function buildFixtureBrowserState(page: Page): BrowserStateSnapshot {
  return {
    browserMode: "fixture",
    browserProfileRef: "playwright-smoke",
    browserExecutablePath: null,
    profileStatus: "profile_ready",
    profileDirectory: "playwright-smoke",
    profileProvisioning: "operator_supplied",
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "local smoke page",
    loginState: "unknown",
    currentUrl: page.url(),
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
    open: true,
    currentTitle: "Playwright DOM Smoke",
    browserExecutable: null,
  };
}

async function buildFixtureGeometrySnapshot(page: Page): Promise<BrowserGeometrySnapshot> {
  const viewport = page.viewportSize() ?? { width: 800, height: 600 };
  return {
    windowX: 0,
    windowY: 0,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    screenshotWidth: viewport.width,
    screenshotHeight: viewport.height,
    scaleFactor: 1,
    currentUrl: page.url(),
    pageTitle: await page.title(),
    visibleContentBounds: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    capturedAt: now(),
  };
}

async function captureFixtureViewport(
  page: Page,
  screenshotDir: string,
  input: { regionLabel: string },
): Promise<BrowserCaptureResult> {
  const geometry = await buildFixtureGeometrySnapshot(page);
  const sourceFilePath = join(screenshotDir, `${input.regionLabel}-${Date.now()}.png`);
  await page.screenshot({ path: sourceFilePath, fullPage: false });
  return {
    browserActionId: `smoke:capture:${Date.now()}`,
    pageUrl: page.url(),
    pageTitle: await page.title(),
    regionLabel: input.regionLabel,
    regionType: "viewport",
    width: geometry.viewportWidth,
    height: geometry.viewportHeight,
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
    sourceFilePath,
    createdAt: now(),
  };
}

async function evaluateFixtureScript<T>(page: Page, input: { script: string }): Promise<T> {
  return page.evaluate<unknown, string>((source) => {
    const run = new Function(source) as () => unknown;
    return run();
  }, input.script) as Promise<T>;
}

async function setFixtureFileInput(
  page: Page,
  input: SmokeFileInput,
): Promise<BrowserActionResult> {
  await page.locator(input.elementRef.selector).setInputFiles(input.filePath);
  return action(`set approved file for ${input.description}`);
}

async function openFixturePage(page: Page, input: SmokeOpenInput): Promise<BrowserActionResult> {
  await page.goto(input.url);
  return action(`opened ${input.title}`);
}

async function clickFixturePoint(page: Page, input: SmokeClickInput): Promise<BrowserActionResult> {
  await page.mouse.click(input.point.x, input.point.y, {
    button: input.button ?? "left",
    clickCount: input.clickCount ?? 1,
  });
  return action(`clicked ${input.targetLabel}`);
}

async function clickLocatedFixturePoint(
  page: Page,
  input: Pick<SmokeClickInput, "targetLabel" | "point">,
): Promise<BrowserActionResult> {
  await page.mouse.click(input.point.x, input.point.y);
  return action(`clicked located DOM element ${input.targetLabel}`);
}

async function typeFixtureTextInput(page: Page, input: SmokeTextInput): Promise<BrowserActionResult> {
  if (input.action === "clear-input") {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.press("Backspace");
    return action(`cleared active input for ${input.targetLabel}`);
  }
  if (input.action === "press-key") {
    await page.keyboard.press(input.key ?? "Enter");
    return action(`pressed key for ${input.targetLabel}`);
  }
  await page.keyboard.type(input.text ?? "");
  return action(`typed text for ${input.targetLabel}`);
}

async function waitForFixtureDuration(page: Page, durationMs: number): Promise<BrowserActionResult> {
  await page.waitForTimeout(durationMs);
  return action(`waited ${durationMs}`);
}

export class PlaywrightDomBrowserAdapter implements BrowserController {
  private closedActiveTabCount = 0;
  constructor(private readonly page: Page, private readonly screenshotDir: string) {}
  getClosedActiveTabCount(): number { return this.closedActiveTabCount; }
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "playwright local DOM smoke adapter" }; }
  getSessionState(): BrowserStateSnapshot { return buildFixtureBrowserState(this.page); }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> { return buildFixtureGeometrySnapshot(this.page); }
  async open(input: SmokeOpenInput): Promise<BrowserActionResult> { return openFixturePage(this.page, input); }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not needed"); }
  async click(input: SmokeClickInput): Promise<BrowserActionResult> { return clickFixturePoint(this.page, input); }
  async clickLocatedDomElement(input: Pick<SmokeClickInput, "targetLabel" | "point">): Promise<BrowserActionResult> { return clickLocatedFixturePoint(this.page, input); }
  async textInput(input: SmokeTextInput): Promise<BrowserActionResult> { return typeFixtureTextInput(this.page, input); }
  async screenshotRegion(input: { regionLabel: string }): Promise<BrowserCaptureResult> { return captureFixtureViewport(this.page, this.screenshotDir, input); }
  async evaluateActiveTab<T>(input: { script: string }): Promise<T> { return evaluateFixtureScript(this.page, input); }
  async setFileInputFiles(input: SmokeFileInput): Promise<BrowserActionResult> { return setFixtureFileInput(this.page, input); }
  async wait(durationMs: number): Promise<BrowserActionResult> { return waitForFixtureDuration(this.page, durationMs); }
  async closeActiveTab(): Promise<BrowserActionResult> {
    this.closedActiveTabCount += 1;
    return action("active tab closed");
  }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}
