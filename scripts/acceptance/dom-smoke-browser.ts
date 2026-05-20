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
  input: {
    elementRef: { selector: string; targetKind: "file-input" };
    filePath: string;
    description: string;
  },
): Promise<BrowserActionResult> {
  await page.locator(input.elementRef.selector).setInputFiles(input.filePath);
  return action(`set approved file for ${input.description}`);
}

export class PlaywrightDomBrowserAdapter implements BrowserController {
  constructor(
    private readonly page: Page,
    private readonly screenshotDir: string,
  ) {}
  getHealth(): { ok: boolean; detail: string } { return { ok: true, detail: "playwright local DOM smoke adapter" }; }
  getSessionState(): BrowserStateSnapshot { return buildFixtureBrowserState(this.page); }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> { return buildFixtureGeometrySnapshot(this.page); }
  async open(input: { url: string; title: string }): Promise<BrowserActionResult> {
    await this.page.goto(input.url);
    return action(`opened ${input.title}`);
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll not needed"); }
  async click(): Promise<BrowserActionResult> { return action("coordinate click not used"); }
  async textInput(): Promise<BrowserActionResult> { return action("text input primitive not used"); }
  async screenshotRegion(input: { regionLabel: string }): Promise<BrowserCaptureResult> { return captureFixtureViewport(this.page, this.screenshotDir, input); }
  async evaluateActiveTab<T>(input: { script: string }): Promise<T> {
    return evaluateFixtureScript(this.page, input);
  }
  async setFileInputFiles(input: {
    elementRef: { selector: string; targetKind: "file-input" };
    filePath: string;
    description: string;
  }): Promise<BrowserActionResult> {
    return setFixtureFileInput(this.page, input);
  }
  async wait(durationMs: number): Promise<BrowserActionResult> { await this.page.waitForTimeout(durationMs); return action(`waited ${durationMs}`); }
  async close(): Promise<BrowserActionResult> { return action("adapter closed"); }
}
