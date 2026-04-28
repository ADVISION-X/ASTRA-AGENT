import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../../lib/browser/browser-controller.js";
import type { BrowserLoginState } from "../../../types/local-browser-session.js";

type FakeBrowserControllerInput = {
  screenshotPath?: string;
  currentUrl?: string;
  currentTitle?: string;
  loginState?: BrowserLoginState;
};

export function createFakeBrowserController(input: FakeBrowserControllerInput = {}): BrowserController {
  const state: BrowserStateSnapshot = {
    browserMode: "real_chrome_persistent",
    browserProfileRef: "test:profile",
    browserExecutablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    profileStatus: "profile_ready",
    profileDirectory: "Default",
    profileProvisioning: "operator_supplied",
    profileVerificationStatus: "operator_verified",
    profileVerificationReason: "test profile",
    loginState: input.loginState ?? "logged_in",
    currentUrl: input.currentUrl ?? "https://www.tiktok.com/foryou",
    lastLoginCheckAt: new Date().toISOString(),
    loginRequiredReason: null,
    reviewRequiredReason: null,
    open: true,
    currentTitle: input.currentTitle ?? "TikTok For You",
    browserExecutable: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };

  const buildActionResult = (message: string, ok = true): BrowserActionResult => ({
    browserActionId: `browser_${Math.random().toString(16).slice(2)}`,
    ok,
    message,
    createdAt: new Date().toISOString(),
    fallbackUsed: false,
  });

  return {
    getHealth() {
      return { ok: true, detail: "fake browser controller" };
    },
    getSessionState() {
      return { ...state };
    },
    async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
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
    },
    async open(openInput) {
      state.currentUrl = openInput.url;
      state.currentTitle = openInput.title;
      return buildActionResult(`opened ${openInput.url}`);
    },
    async scroll() {
      return buildActionResult("scroll noop");
    },
    async click() {
      return buildActionResult("click noop");
    },
    async screenshotRegion(screenshotInput): Promise<BrowserCaptureResult> {
      return {
        browserActionId: `capture_${Math.random().toString(16).slice(2)}`,
        pageUrl: state.currentUrl,
        pageTitle: state.currentTitle,
        regionLabel: screenshotInput.regionLabel,
        regionType: "viewport",
        width: 1280,
        height: 720,
        ...(screenshotInput.contentLines ? { contentLines: screenshotInput.contentLines } : {}),
        ...(input.screenshotPath ? { sourceFilePath: input.screenshotPath } : {}),
        createdAt: new Date().toISOString(),
      };
    },
    async wait(durationMs) {
      return buildActionResult(`waited ${durationMs}`);
    },
    async close() {
      return buildActionResult("closed");
    },
  };
}

export function assertCapabilityCheck(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export async function createCapabilityCheckDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `${prefix}-`));
}

export async function createSampleImage(filePath: string, width = 64, height = 48): Promise<void> {
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 32, g: 64, b: 128 },
    },
  })
    .png()
    .toFile(filePath);
}