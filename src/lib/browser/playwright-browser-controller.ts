import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "./browser-controller.js";
import { createInitialLocalBrowserSessionState, type createLocalBrowserSessionConfig } from "./local-browser-session.js";
import { createId } from "../local-runtime/ids.js";

type PlaywrightBrowserControllerOptions = {
  sessionConfig: ReturnType<typeof createLocalBrowserSessionConfig>;
  screenshotDir: string;
  headlessRequested?: boolean;
};

export class PlaywrightBrowserController implements BrowserController {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private snapshot: BrowserStateSnapshot;

  constructor(private readonly options: PlaywrightBrowserControllerOptions) {
    if (options.headlessRequested === true) {
      throw new Error("Real-platform mode forbids headless browser launch; use a local real Chrome profile instead.");
    }

    this.snapshot = {
      ...createInitialLocalBrowserSessionState(options.sessionConfig),
      open: false,
      currentUrl: "about:blank",
      currentTitle: "GrassEye Real Browser",
      browserExecutable: options.sessionConfig.chromeExecutablePath,
    };
  }

  getHealth(): { ok: boolean; detail: string } {
    if (!this.options.sessionConfig.chromeExecutablePath) {
      return {
        ok: false,
        detail: `local real Chrome executable unavailable for ${this.options.sessionConfig.profileRef}`,
      };
    }

    if (!this.snapshot.open) {
      return {
        ok: true,
        detail: `${this.snapshot.browserMode} profile ${this.snapshot.browserProfileRef} is ${this.snapshot.profileStatus}`,
      };
    }

    return {
      ok: true,
      detail: `${this.snapshot.browserMode} profile ${this.snapshot.browserProfileRef} open on ${this.snapshot.currentUrl}`,
    };
  }

  getSessionState(): BrowserStateSnapshot {
    return { ...this.snapshot };
  }

  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    const page = await this.ensurePage();
    const viewport = page.viewportSize() ?? { width: 1440, height: 960 };
    const geometry = await page.evaluate(() => {
      return {
        windowX: typeof window.screenX === "number" ? window.screenX : 0,
        windowY: typeof window.screenY === "number" ? window.screenY : 0,
        scaleFactor: typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1,
      };
    }).catch(() => ({ windowX: 0, windowY: 0, scaleFactor: 1 }));

    return {
      windowX: geometry.windowX,
      windowY: geometry.windowY,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      screenshotWidth: viewport.width,
      screenshotHeight: viewport.height,
      scaleFactor: geometry.scaleFactor,
      currentUrl: page.url(),
      pageTitle: this.snapshot.currentTitle,
      visibleContentBounds: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      },
      capturedAt: new Date().toISOString(),
    };
  }

  async open(input: { url: string; title: string }): Promise<BrowserActionResult> {
    const page = await this.ensurePage();
    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 2_500 }).catch(() => undefined);
    await this.refreshSnapshot(page, input.title);
    return this.createActionResult(`opened ${input.url}`);
  }

  async scroll(input: { direction: "forward" | "backward" }): Promise<BrowserActionResult> {
    const page = await this.ensurePage();
    const viewport = page.viewportSize() ?? { width: 1440, height: 960 };
    const delta = input.direction === "forward" ? 900 : -900;
    const key = input.direction === "forward" ? "PageDown" : "PageUp";
    await page.bringToFront().catch(() => undefined);
    await page.keyboard.press(key).catch(() => undefined);
    await page.mouse.move(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(1200);
    await this.refreshSnapshot(page);
    return this.createActionResult(`scrolled ${input.direction}`);
  }

  async click(input: { targetLabel: string; point: { x: number; y: number }; fallbackUsed?: boolean }): Promise<BrowserActionResult> {
    const page = await this.ensurePage();
    await page.mouse.click(input.point.x, input.point.y);
    await page.waitForTimeout(700);
    await this.refreshSnapshot(page);
    return this.createActionResult(`clicked ${input.targetLabel}`, input.fallbackUsed ?? false);
  }

  async screenshotRegion(input: { regionLabel: string; contentLines?: string[] }): Promise<BrowserCaptureResult> {
    const page = await this.ensurePage();
    await mkdir(this.options.screenshotDir, { recursive: true });
    const screenshotPath = path.join(this.options.screenshotDir, `${createId(input.regionLabel)}.png`);
    const viewport = page.viewportSize() ?? { width: 1440, height: 960 };
    await page.screenshot({ path: screenshotPath, fullPage: false });

    await this.refreshSnapshot(page);

    const createdAt = new Date().toISOString();
    return {
      browserActionId: createId("browser"),
      pageUrl: this.snapshot.currentUrl,
      pageTitle: this.snapshot.currentTitle,
      regionLabel: input.regionLabel,
      regionType: "viewport",
      width: viewport.width,
      height: viewport.height,
      ...(input.contentLines ? { contentLines: input.contentLines } : {}),
      sourceFilePath: screenshotPath,
      createdAt
    };
  }

  async wait(durationMs: number): Promise<BrowserActionResult> {
    const page = await this.ensurePage();
    await page.waitForTimeout(durationMs);
    await this.refreshSnapshot(page);
    return this.createActionResult(`waited ${durationMs}ms`);
  }

  async close(): Promise<BrowserActionResult> {
    if (this.context) {
      await this.context.close();
    }
    this.context = null;
    this.page = null;
    this.snapshot = {
      ...createInitialLocalBrowserSessionState(this.options.sessionConfig),
      open: false,
      currentUrl: "about:blank",
      currentTitle: "GrassEye Real Browser",
      browserExecutable: this.options.sessionConfig.chromeExecutablePath,
    };
    return this.createActionResult("closed browser session");
  }

  private async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    const executablePath = this.options.sessionConfig.chromeExecutablePath;
    if (!executablePath) {
      this.snapshot = {
        ...this.snapshot,
        profileStatus: "profile_unavailable",
        loginState: "review_required",
        reviewRequiredReason: "local real Chrome executable unavailable",
        lastLoginCheckAt: new Date().toISOString(),
      };
      throw new Error("Local real Chrome executable unavailable for persistent real-platform session.");
    }

    await mkdir(this.options.sessionConfig.userDataDir, { recursive: true });
    try {
      this.context = await chromium.launchPersistentContext(this.options.sessionConfig.userDataDir, {
        executablePath,
        headless: false,
        viewport: { width: 1440, height: 960 },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const profileStatus = /lock|singleton/i.test(message) ? "profile_locked" : "profile_unavailable";
      this.snapshot = {
        ...this.snapshot,
        profileStatus,
        loginState: "review_required",
        reviewRequiredReason: message,
        lastLoginCheckAt: new Date().toISOString(),
      };
      throw error;
    }

    this.page = this.context.pages()[0] ?? await this.context.newPage();
    this.snapshot = {
      ...this.snapshot,
      profileStatus: "profile_ready",
      reviewRequiredReason: null,
    };
    await this.refreshSnapshot(this.page);
    return this.page;
  }

  private async refreshSnapshot(page: Page, fallbackTitle?: string): Promise<void> {
    const title = await page.title().catch(() => fallbackTitle ?? "GrassEye Real Browser");
    const currentUrl = page.url();
    const loginState = this.resolveLoginState(currentUrl, title || fallbackTitle || "GrassEye Real Browser");
    this.snapshot = {
      ...this.snapshot,
      open: !page.isClosed(),
      currentUrl,
      currentTitle: title || fallbackTitle || "GrassEye Real Browser",
      loginState,
      profileStatus: loginState === "logged_in" ? "logged_in" : loginState === "login_required" ? "login_required" : this.snapshot.profileStatus,
      loginRequiredReason: loginState === "login_required" ? "operator login required inside local Chrome profile" : null,
      reviewRequiredReason: loginState === "review_required" ? "browser challenge or safety review required" : null,
      lastLoginCheckAt: new Date().toISOString(),
    };
  }

  private resolveLoginState(currentUrl: string, currentTitle: string): BrowserStateSnapshot["loginState"] {
    const normalizedUrl = currentUrl.toLowerCase();
    const normalizedTitle = currentTitle.toLowerCase();
    if (normalizedUrl === "about:blank") {
      return "unknown";
    }

    if (
      normalizedUrl.includes("captcha")
      || normalizedUrl.includes("challenge")
      || normalizedTitle.includes("captcha")
      || normalizedTitle.includes("verify")
      || normalizedTitle.includes("safety")
    ) {
      return "review_required";
    }

    if (
      normalizedUrl.includes("login")
      || normalizedUrl.includes("signin")
      || normalizedUrl.includes("signup")
      || normalizedTitle.includes("log in")
      || normalizedTitle.includes("sign in")
      || normalizedTitle.includes("sign up")
    ) {
      return "login_required";
    }

    return "logged_in";
  }

  private createActionResult(message: string, fallbackUsed = false, ok = true): BrowserActionResult {
    return {
      browserActionId: createId("browser"),
      ok,
      message,
      createdAt: new Date().toISOString(),
      fallbackUsed
    };
  }
}