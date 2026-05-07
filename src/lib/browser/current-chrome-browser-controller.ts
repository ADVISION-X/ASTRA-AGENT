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
  activateChrome,
  buildOpenUrlScript,
  clickAt,
  escapeAppleScriptText,
  pressBrowserKey,
  readFrontChromeWindowState,
  runAppleScript,
  scrollAt,
} from "./current-chrome-browser-controller-primitives.js";
import {
  createBrowserActionResult,
  resolveChromeLoginState,
} from "./current-chrome-browser-session-state.js";
import { captureCurrentChromeScreenshot } from "./current-chrome-browser-screenshot.js";
import { executeCurrentChromeTextInput } from "./current-chrome-browser-text-input.js";

type CurrentChromeBrowserControllerOptions = {
  sessionConfig: LocalBrowserSessionConfig;
  screenshotDir: string;
  headlessRequested?: boolean;
};

type ScrollVideoIdentitySnapshot = {
  url: string | null;
  title: string | null;
  videoKey: string | null;
  capturedAt: string;
};

const SCROLL_NEXT_VIDEO_OBSERVATION_TIMEOUT_MS = 8_000;
const SCROLL_NEXT_VIDEO_OBSERVATION_POLL_MS = 250;

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
    await this.wait(1200);
    await this.refreshSnapshot();
    return this.createActionResult({ message: `opened ${input.url} in current Chrome session` });
  }

  async scroll(input: { targetLabel: string; deltaX: number; deltaY: number; coordinateSpace?: BrowserScrollCoordinateSpace; anchorPoint?: { x: number; y: number }; fallbackUsed?: boolean; abortSignal?: AbortSignal }): Promise<BrowserActionResult> {
    const geometry = this.lastWindowState ?? await this.refreshSnapshot();
    const coordinateSpace = input.coordinateSpace ?? "browserViewport";
    const anchorPoint = input.anchorPoint ?? {
      x: Math.round(geometry.width / 2),
      y: Math.round(geometry.height / 2),
    };
    const scrollX = coordinateSpace === "desktopScreen" ? anchorPoint.x : geometry.windowX + anchorPoint.x;
    const scrollY = coordinateSpace === "desktopScreen" ? anchorPoint.y : geometry.windowY + anchorPoint.y;
    if (input.deltaX === 0 && input.deltaY === 0) {
      return this.createActionResult({ message: `skipped zero scroll for ${input.targetLabel}`, ok: false, fallbackUsed: input.fallbackUsed ?? false });
    }
    const requiresVideoAdvanceObservation = input.targetLabel.includes("scroll_next_video") && input.deltaY > 0;
    const beforeVideoIdentity = requiresVideoAdvanceObservation
      ? await this.readCurrentVideoIdentitySnapshot(input.abortSignal)
      : null;
    await activateChrome(input.abortSignal);
    await scrollAt({
      x: Math.round(scrollX),
      y: Math.round(scrollY),
      deltaX: input.deltaX,
      deltaY: input.deltaY,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
    let auxiliaryKeyMessage = "";
    if (requiresVideoAdvanceObservation) {
      await this.sleep(120, input.abortSignal);
      try {
        await pressBrowserKey(125, input.abortSignal);
        auxiliaryKeyMessage = " with ArrowDown assist";
      } catch (error) {
        auxiliaryKeyMessage = `; ArrowDown assist skipped: ${error instanceof Error ? error.message : "unknown key dispatch error"}`;
      }
    }
    const observationMessage = requiresVideoAdvanceObservation
      ? await this.waitForScrollNextVideoIdentityChange(beforeVideoIdentity, input.abortSignal)
      : (await this.sleep(300, input.abortSignal), "browser scroll settle observed");
    await this.refreshSnapshot();
    return this.createActionResult({ message: `scrolled ${input.targetLabel} dx=${input.deltaX} dy=${input.deltaY}${auxiliaryKeyMessage}; ${observationMessage}`, fallbackUsed: input.fallbackUsed ?? false });
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
    const screenshot = await captureCurrentChromeScreenshot({
      screenshotDir: this.options.screenshotDir,
      geometry,
      regionLabel: input.regionLabel,
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

  private async readCurrentVideoIdentitySnapshot(abortSignal?: AbortSignal): Promise<ScrollVideoIdentitySnapshot | null> {
    const script = `
(() => {
  const visibleArea = (rect) => {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth || 0, rect.right);
    const bottom = Math.min(window.innerHeight || 0, rect.bottom);
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  };
  const nearestHref = (element) => {
    const direct = element.closest("a[href]");
    if (direct) return direct.href;
    let parent = element.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1, parent = parent.parentElement) {
      const anchor = parent.querySelector('a[href*="/reel/"],a[href*="/watch"],a[href*="/videos/"],a[href*="/video/"]');
      if (anchor) return anchor.href;
    }
    return "";
  };
  const videos = Array.from(document.querySelectorAll("video"))
    .map((video, index) => {
      const rect = video.getBoundingClientRect();
      const duration = Number.isFinite(video.duration) ? String(Math.round(video.duration * 100) / 100) : "";
      const parts = [
        video.currentSrc || video.src || "",
        video.poster || "",
        nearestHref(video),
        duration,
        String(Math.round(rect.left)),
        String(Math.round(rect.top)),
        String(Math.round(rect.width)),
        String(Math.round(rect.height)),
      ].filter(Boolean);
      return { index, area: visibleArea(rect), key: parts.join("|") };
    })
    .filter((entry) => entry.area > 1024 && entry.key.length > 0)
    .sort((left, right) => right.area - left.area || left.index - right.index);
  const activeVideo = videos[0] || null;
  return JSON.stringify({
    url: location.href || null,
    title: document.title || null,
    videoKey: activeVideo ? activeVideo.key : null,
    capturedAt: new Date().toISOString(),
  });
})()
`;
    try {
      const output = await runAppleScript(`
tell application "Google Chrome"
    if (count of windows) = 0 then return ""
    return execute active tab of front window javascript "${escapeAppleScriptText(script)}"
end tell
`, abortSignal ? { signal: abortSignal } : undefined);
      const parsed = JSON.parse(output) as ScrollVideoIdentitySnapshot;
      return {
        url: typeof parsed.url === "string" ? parsed.url : null,
        title: typeof parsed.title === "string" ? parsed.title : null,
        videoKey: typeof parsed.videoKey === "string" ? parsed.videoKey : null,
        capturedAt: typeof parsed.capturedAt === "string" ? parsed.capturedAt : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private normalizeComparableUrl(value: string | null): string | null {
    if (value === null || !URL.canParse(value)) {
      return value;
    }
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString();
  }

  private didVideoIdentityChange(before: ScrollVideoIdentitySnapshot | null, after: ScrollVideoIdentitySnapshot | null): boolean {
    if (before === null || after === null) {
      return false;
    }
    if (before.videoKey !== null && after.videoKey !== null && before.videoKey !== after.videoKey) {
      return true;
    }
    const beforeUrl = this.normalizeComparableUrl(before.url);
    const afterUrl = this.normalizeComparableUrl(after.url);
    return beforeUrl !== null && afterUrl !== null && beforeUrl !== afterUrl;
  }

  private async waitForScrollNextVideoIdentityChange(before: ScrollVideoIdentitySnapshot | null, abortSignal?: AbortSignal): Promise<string> {
    const deadline = Date.now() + SCROLL_NEXT_VIDEO_OBSERVATION_TIMEOUT_MS;
    let lastSnapshot: ScrollVideoIdentitySnapshot | null = null;
    while (Date.now() < deadline) {
      lastSnapshot = await this.readCurrentVideoIdentitySnapshot(abortSignal);
      if (this.didVideoIdentityChange(before, lastSnapshot)) {
        return "AND THEN observed video identity change";
      }
      await this.sleep(SCROLL_NEXT_VIDEO_OBSERVATION_POLL_MS, abortSignal);
    }
    const beforeState = before?.videoKey ?? before?.url ?? "unknown-before-video-identity";
    const afterState = lastSnapshot?.videoKey ?? lastSnapshot?.url ?? "unknown-after-video-identity";
    return `AND THEN fallback timeout reached without video identity change before=${beforeState} after=${afterState}`;
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
