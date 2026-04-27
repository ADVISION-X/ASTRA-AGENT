import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createId } from "../../../lib/local-runtime/ids.js";
import type { BrowserActionResult, BrowserController, BrowserGeometrySnapshot } from "../../../lib/browser/browser-controller.js";
import type { PlatformAdapter, PlatformCapture, PlatformObservation, PlatformOperatorModeInfo, PlatformRuntimeDiagnostics, PlatformRuntimePageCapture, PlatformVideo } from "../platform-adapter.js";
import { PlatformActionRequestSchema, PlatformActionResultSchema, type PlatformActionRequest, type PlatformActionResult } from "../../../types/platform-action.js";
import { ScreenGeometryGuard, type ScreenGeometrySnapshot } from "../screen-geometry-guard.js";
import { VisionCoordinatePlatformAdapter } from "./vision-coordinate-platform-adapter.js";
import type { RuntimePageReadyStatus } from "../../../types/runtime.js";
import type { VisualActionResult, VisualActionVerificationResult, VisualTarget } from "../../../types/visual-action.js";

const TIKTOK_PLATFORM_ID = "tiktok-web";
const DEFAULT_TIKTOK_URL = "https://www.tiktok.com/foryou";

const REVIEW_REQUIRED_TAG = "platform-review-required";

function normalizeVideoId(input: {
  url: string;
  title?: string;
  summary?: string;
  tags?: string[];
  roundIndex: number;
}): string {
  const identitySource = [
    input.url,
    input.title ?? "",
    input.summary ?? "",
    (input.tags ?? []).join(" "),
  ]
    .join(" ")
    .trim();
  const compact = identitySource.replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "");
  return compact.length > 0 ? compact.slice(0, 96) : `tiktok-round-${input.roundIndex}`;
}

function extractTags(lines: string[]): string[] {
  const tags = lines
    .flatMap((line) => line.split(/\s+/))
    .filter((part) => part.startsWith("#"))
    .map((part) => part.replaceAll(/[^#\p{L}\p{N}_-]+/gu, ""));
  return [...new Set(tags)].slice(0, 8);
}

function summarizeLoginState(loginState: BrowserController["getSessionState"] extends () => infer T ? T extends { loginState: infer S } ? S : never : never): string {
  switch (loginState) {
    case "logged_in":
      return "logged_in_visual_session";
    case "login_required":
      return "login_required_visual_review";
    case "review_required":
      return "review_required_visual_session";
    default:
      return "unknown_visual_session";
  }
}

function toScreenGeometrySnapshot(geometry: BrowserGeometrySnapshot): ScreenGeometrySnapshot {
  return {
    x: geometry.windowX,
    y: geometry.windowY,
    width: geometry.viewportWidth,
    height: geometry.viewportHeight,
    screenshotWidth: geometry.screenshotWidth,
    screenshotHeight: geometry.screenshotHeight,
    scaleFactor: geometry.scaleFactor,
    capturedAt: geometry.capturedAt,
  };
}

function createDefaultGeometryBaseline(): ScreenGeometrySnapshot {
  return {
    x: 0,
    y: 0,
    width: 1440,
    height: 960,
    screenshotWidth: 1440,
    screenshotHeight: 960,
    scaleFactor: 1,
    capturedAt: new Date().toISOString(),
  };
}

type GovernedVisualActionExecution = {
  browserResult: BrowserActionResult;
  visualTarget: VisualTarget;
  visualActionResult: VisualActionResult;
  geometryStatus: string;
};

export class TikTokPlatformAdapter extends VisionCoordinatePlatformAdapter implements PlatformAdapter {
  readonly defaultMaxRounds = 5;

  private currentIndex = 0;
  private currentVideo: PlatformVideo | null = null;
  private pageReadyStatus: RuntimePageReadyStatus = "idle";
  private lastNavigationError: string | null = null;
  private operatorModeInfo: PlatformOperatorModeInfo = {
    executionMode: "Vision-first Coordinate Mode",
    fallbackMode: "Visual-only Coordinate Runtime",
    geometryGuard: "Not calibrated",
    viewport: "unknown",
    calibration: "Calibration required",
  };

  constructor(
    browserController: BrowserController,
    private readonly startUrl = DEFAULT_TIKTOK_URL,
  ) {
    super(browserController, new ScreenGeometryGuard(createDefaultGeometryBaseline()));
  }

  get platformId(): string {
    return TIKTOK_PLATFORM_ID;
  }

  getOperatorModeInfo(): PlatformOperatorModeInfo {
    return { ...this.operatorModeInfo };
  }

  getRuntimeDiagnostics(): PlatformRuntimeDiagnostics {
    const session = this.browserController.getSessionState();
    return {
      targetUrl: this.startUrl,
      currentUrl: session.currentUrl,
      pageTitle: session.currentTitle,
      pageReadyStatus: this.pageReadyStatus,
      lastNavigationError: this.lastNavigationError,
    };
  }

  listVideos(): PlatformVideo[] {
    return this.currentVideo ? [this.currentVideo] : [];
  }

  async captureRuntimePageState(requestInput: PlatformActionRequest): Promise<PlatformRuntimePageCapture> {
    PlatformActionRequestSchema.parse(requestInput);
    const session = this.browserController.getSessionState();
    const capture = await this.browserController.screenshotRegion({
      regionLabel: "runtime-page-state",
      contentLines: [session.currentUrl || this.startUrl, summarizeLoginState(session.loginState)],
    });
    const screenshotHash = await this.hashCapture(capture.sourceFilePath);

    return {
      platformId: this.platformId,
      sourceId: normalizeVideoId({
        url: session.currentUrl || this.startUrl,
        summary: screenshotHash,
        roundIndex: this.currentIndex,
      }),
      summary: `visual runtime page capture ${screenshotHash.slice(0, 24)}`,
      capture,
    };
  }

  reset(): void {
    this.currentIndex = 0;
    this.currentVideo = null;
    this.pageReadyStatus = "idle";
    this.lastNavigationError = null;
    this.operatorModeInfo = {
      executionMode: "Vision-first Coordinate Mode",
      fallbackMode: "Visual-only Coordinate Runtime",
      geometryGuard: "Not calibrated",
      viewport: "unknown",
      calibration: "Calibration required",
    };
  }

  seek(index: number): void {
    this.currentIndex = Math.max(0, index);
  }

  hasCurrentVideo(): boolean {
    return this.currentIndex < this.defaultMaxRounds;
  }

  async openFeed(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    this.pageReadyStatus = "opening_target_page";
    this.lastNavigationError = null;

    let browserResult: BrowserActionResult;
    try {
      browserResult = await this.browserController.open({
        url: this.startUrl,
        title: "TikTok For You"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.pageReadyStatus = "navigation_failed";
      this.lastNavigationError = `target navigation failed: ${message}`;
      return this.toActionResult(request, "failed", this.lastNavigationError, false);
    }

    this.pageReadyStatus = "waiting_page_ready";
    const pageStatus = await this.getPageAccessStatus();
    if (!browserResult.ok || !pageStatus.ok) {
      this.pageReadyStatus = "review_required";
      this.lastNavigationError = pageStatus.message ?? browserResult.message;
      return this.toActionResult(
        request,
        "failed",
        pageStatus.message ?? browserResult.message,
        browserResult.fallbackUsed
      );
    }

    await this.calibrateGeometryGuard();
    this.pageReadyStatus = "page_ready";

    return this.toActionResult(request, "success", browserResult.message, browserResult.fallbackUsed);
  }

  async observeCurrentVideo(requestInput: PlatformActionRequest): Promise<PlatformObservation> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    await this.browserController.wait(1500);
    const video = await this.readCurrentVideo();
    this.currentVideo = video;
    return {
      platformId: this.platformId,
      video,
      actionResult: this.toActionResult(request, "success", `observed ${video.id}`, false, video.id)
    };
  }

  async captureVideoRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const video = await this.requireCurrentVideo();
    const capture = await this.browserController.screenshotRegion({
      regionLabel: "video-region",
      contentLines: [video.title, video.summary, `tags: ${video.tags.join(", ")}`]
    });
    return {
      platformId: this.platformId,
      video,
      capture,
      actionResult: this.toActionResult(request, "success", `captured video region for ${video.id}`, false, video.id)
    };
  }

  async clickNotInterested(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const currentVideoId = this.currentVideo?.id;
    return this.toActionResult(request, "skipped", "tiktok not-interested action is not automated in phase 3 MVP", false, currentVideoId);
  }

  async likeOrSaveCandidate(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const execution = await this.executeCoordinateAction({
      actionType: "like_or_save_candidate",
      targetLabel: "like candidate",
      targetType: "like_button",
      box: (geometry) => ({
        x: geometry.viewportWidth * 0.9,
        y: geometry.viewportHeight * 0.48,
        width: Math.max(56, geometry.viewportWidth * 0.045),
        height: Math.max(56, geometry.viewportHeight * 0.08),
      }),
      verificationExpectation: "like or save marker state changes after click",
      verifyAfterAction: async () => this.buildUnableToVerifyResult("dom-state-uncertain", "marker state selectors remain heuristic"),
    });
    return this.toActionResult(
      request,
      execution.browserResult.ok ? "success" : "failed",
      execution.browserResult.message,
      execution.browserResult.fallbackUsed,
      this.currentVideo?.id,
      execution.visualTarget,
      execution.visualActionResult,
      execution.geometryStatus,
    );
  }

  async openComments(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const execution = await this.executeCoordinateAction({
      actionType: "open_comments",
      targetLabel: "open comments",
      targetType: "comments_button",
      box: (geometry) => ({
        x: geometry.viewportWidth * 0.9,
        y: geometry.viewportHeight * 0.61,
        width: Math.max(56, geometry.viewportWidth * 0.045),
        height: Math.max(56, geometry.viewportHeight * 0.08),
      }),
      verificationExpectation: "comments panel becomes visible after click",
      verifyAfterAction: async (afterCapture) => {
        return {
          verified: false,
          verificationMethod: "post_action_screenshot_presence",
          expectedChange: "comments_panel visible",
          observedChange: afterCapture.regionType,
          confidence: 0,
          failureReason: "comments_panel not detected after coordinate action",
        };
      },
    });
    return this.toActionResult(
      request,
      execution.browserResult.ok ? "success" : "failed",
      execution.browserResult.message,
      execution.browserResult.fallbackUsed,
      this.currentVideo?.id,
      execution.visualTarget,
      execution.visualActionResult,
      execution.geometryStatus,
    );
  }

  async captureCommentRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const video = await this.requireCurrentVideo();
    const capture = await this.browserController.screenshotRegion({
      regionLabel: "comment-region",
      contentLines: ["visual comment capture", video.id]
    });
    return {
      platformId: this.platformId,
      video: {
        ...video,
        comments: video.comments
      },
      capture,
      actionResult: this.toActionResult(
        request,
        "success",
        `captured comment region for ${video.id}`,
        false,
        video.id,
      )
    };
  }

  async continueNext(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const previousVideoId = this.currentVideo?.id ?? null;
    this.currentIndex += 1;
    this.currentVideo = null;
    let fallbackUsed = false;
    let latestVideoId = previousVideoId;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const scrollResult = await this.browserController.scroll({ direction: "forward" });
      fallbackUsed = fallbackUsed || scrollResult.fallbackUsed;
      await this.browserController.wait(1200);
      const observedVideo = await this.readCurrentVideo();
      this.currentVideo = observedVideo;
      latestVideoId = observedVideo.id;

      if (scrollResult.ok && (!previousVideoId || observedVideo.id !== previousVideoId)) {
        const message = attempt === 1
          ? `scrolled forward to ${observedVideo.id}`
          : `scroll retry ${attempt} reached ${observedVideo.id}`;
        return this.toActionResult(request, "success", message, fallbackUsed, observedVideo.id);
      }
    }

    return this.toActionResult(
      request,
      "failed",
      `scroll did not advance to a new video after 5 attempts; current videoVisitId=${latestVideoId}`,
      fallbackUsed,
      latestVideoId ?? undefined,
    );
  }

  async close(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    const browserResult = await this.browserController.close();
    return this.toActionResult(request, browserResult.ok ? "success" : "failed", browserResult.message, browserResult.fallbackUsed);
  }

  private async readCurrentVideo(): Promise<PlatformVideo> {
    const session = this.browserController.getSessionState();
    const capture = await this.browserController.screenshotRegion({
      regionLabel: "current-video-identification",
      contentLines: [session.currentUrl || this.startUrl, summarizeLoginState(session.loginState)],
    });
    const screenshotHash = await this.hashCapture(capture.sourceFilePath);

    if (this.requiresOperatorReview(session.currentUrl, session.loginState)) {
      const reviewTitle = session.currentTitle || "TikTok review required";
      const reviewSummary = this.buildReviewRequiredSummary(session.currentUrl, session.loginState);
      return {
        id: normalizeVideoId({
          url: session.currentUrl || this.startUrl,
          title: reviewTitle,
          summary: reviewSummary,
          tags: ["uncertain", REVIEW_REQUIRED_TAG],
          roundIndex: this.currentIndex,
        }),
        title: reviewTitle,
        pageUrl: session.currentUrl || this.startUrl,
        summary: reviewSummary,
        tags: ["uncertain", REVIEW_REQUIRED_TAG],
        comments: []
      };
    }

    const title = session.currentTitle || `TikTok visual round ${this.currentIndex + 1}`;
    const summary = `visual video capture ${screenshotHash.slice(0, 32)}`;
    const tags = extractTags([session.currentUrl || this.startUrl, summarizeLoginState(session.loginState)]);
    return {
      id: normalizeVideoId({
        url: session.currentUrl || this.startUrl,
        title,
        summary,
        tags,
        roundIndex: this.currentIndex,
      }),
      title,
      pageUrl: session.currentUrl || this.startUrl,
      summary,
      tags,
      comments: []
    };
  }

  private async requireCurrentVideo(): Promise<PlatformVideo> {
    if (this.currentVideo) {
      return this.currentVideo;
    }

    const video = await this.readCurrentVideo();
    this.currentVideo = video;
    return video;
  }

  private async getPageAccessStatus(): Promise<{ ok: boolean; message?: string }> {
    const session = this.browserController.getSessionState();
    if (session.currentUrl !== "about:blank" && !this.requiresOperatorReview(session.currentUrl, session.loginState)) {
      return { ok: true };
    }

    if (this.requiresOperatorReview(session.currentUrl, session.loginState)) {
      return {
        ok: false,
        message: this.buildReviewRequiredSummary(session.currentUrl, session.loginState)
      };
    }

    return { ok: true };
  }

  private async calibrateGeometryGuard(): Promise<void> {
    const geometry = await this.browserController.getGeometrySnapshot();
    const baseline = toScreenGeometrySnapshot(geometry);
    this.setGeometryGuard(new ScreenGeometryGuard(baseline));
    this.lastNavigationError = null;
    this.operatorModeInfo = {
      executionMode: "Vision-first Coordinate Mode",
      fallbackMode: "Visual-only Coordinate Runtime",
      geometryGuard: "Calibrated",
      viewport: `${geometry.viewportWidth} x ${geometry.viewportHeight} @ ${geometry.scaleFactor.toFixed(2)}`,
      calibration: `Baseline captured ${geometry.capturedAt}`,
    };
  }

  private async executeCoordinateAction(input: {
    actionType: "like_or_save_candidate" | "open_comments";
    targetLabel: string;
    targetType: "like_button" | "comments_button";
    box: (geometry: BrowserGeometrySnapshot) => { x: number; y: number; width: number; height: number };
    verificationExpectation: string;
    verifyAfterAction: (afterCapture: Awaited<ReturnType<TikTokPlatformAdapter["captureActionEvidence"]>>) => Promise<VisualActionVerificationResult>;
  }): Promise<GovernedVisualActionExecution> {
    const geometry = await this.browserController.getGeometrySnapshot();
    const guardResult = this.geometryGuard.verify(toScreenGeometrySnapshot(geometry));
    if (!guardResult.ok) {
      this.pageReadyStatus = "review_required";
      this.operatorModeInfo = {
        ...this.operatorModeInfo,
        geometryGuard: "Mismatch detected",
        calibration: guardResult.reason,
      };
      const blockedTarget = this.buildVisualTarget({
        targetType: input.targetType,
        boundingBox: input.box(geometry),
        confidence: 0,
        sourceScreenshotEvidenceId: createId("visual_target_blocked"),
        detectionMethod: "geometry_guard_block",
        uncertainty: [guardResult.reason],
        blockedReason: guardResult.reason,
      });
      return {
        browserResult: this.createBrowserFailureResult(guardResult.reason),
        visualTarget: blockedTarget,
        visualActionResult: this.buildVisualActionResult({
          result: "review_required",
          verificationResult: {
            verified: false,
            verificationMethod: "geometry_guard",
            expectedChange: input.verificationExpectation,
            observedChange: "geometry_guard_blocked",
            confidence: 1,
            failureReason: guardResult.reason,
          },
          failureReason: guardResult.reason,
        }),
        geometryStatus: guardResult.status,
      };
    }

    const beforeCapture = await this.captureActionEvidence({
      regionLabel: `${input.targetType}-pre-action`,
      contentLines: [
        `mode: vision-first-coordinate`,
        `target: ${input.targetType}`,
        `viewport: ${geometry.viewportWidth}x${geometry.viewportHeight}`,
      ],
    });

    const target = this.buildVisualTarget({
      targetType: input.targetType,
      boundingBox: input.box(geometry),
      confidence: 0.76,
      sourceScreenshotEvidenceId: beforeCapture.browserActionId,
      detectionMethod: "heuristic_viewport_box",
      uncertainty: ["heuristic viewport target pending model-backed visual target detection"],
    });

    const coordinateResult = await this.executeVisionCoordinateAction({
      actionType: input.actionType,
      target,
      geometrySnapshot: toScreenGeometrySnapshot(geometry),
    }).catch((error: unknown) => this.createBrowserFailureResult(error instanceof Error ? error.message : String(error)));

    const afterCapture = await this.captureActionEvidence({
      regionLabel: `${input.targetType}-post-action`,
      contentLines: [`target: ${input.targetType}`, `coordinate-click-attempted: ${coordinateResult.ok ? "yes" : "no"}`],
    });
    const verificationResult = await input.verifyAfterAction(afterCapture);
    const visualActionResult = this.buildVisualActionResult({
      result: coordinateResult.ok
        ? verificationResult.verified ? "success" : "failed"
        : "failed",
      afterEvidenceId: afterCapture.browserActionId,
      verificationResult,
      failureReason: coordinateResult.ok ? verificationResult.failureReason : coordinateResult.message,
    });

    if (coordinateResult.ok && verificationResult.verified) {
      return {
        browserResult: coordinateResult,
        visualTarget: target,
        visualActionResult,
        geometryStatus: guardResult.status,
      };
    }

    return {
      browserResult: this.createBrowserFailureResult(
        coordinateResult.ok
          ? verificationResult.failureReason ?? `${input.targetLabel} post-action verification failed`
            : `${coordinateResult.message}; visual-only runtime forbids DOM fallback`,
      ),
      visualTarget: target,
      visualActionResult,
      geometryStatus: guardResult.status,
    };
  }

  private async buildUnableToVerifyResult(observedChange: string, reason: string): Promise<VisualActionVerificationResult> {
    return {
      verified: false,
      verificationMethod: "unable_to_verify",
      expectedChange: reason,
      observedChange,
      confidence: 0,
      failureReason: "unable_to_verify",
    };
  }

  private createBrowserFailureResult(message: string): BrowserActionResult {
    return {
      browserActionId: createId("browser"),
      ok: false,
      message,
      createdAt: new Date().toISOString(),
      fallbackUsed: false,
    };
  }

  private requiresOperatorReview(currentUrl: string, loginState: ReturnType<BrowserController["getSessionState"]>["loginState"]): boolean {
    return currentUrl === "about:blank" || loginState === "login_required" || loginState === "review_required";
  }

  private buildReviewRequiredSummary(currentUrl: string, loginState: ReturnType<BrowserController["getSessionState"]>["loginState"]): string {
    if (currentUrl === "about:blank") {
      return "uncertain platform access: real platform page is blank and requires operator review";
    }

    if (loginState === "review_required") {
      return "uncertain platform access: captcha or verification wall detected and requires operator review";
    }

    if (loginState === "login_required") {
      return "uncertain platform access: login wall detected and requires operator review";
    }

    return "uncertain platform access: platform page structure not recognized and requires operator review";
  }

  private async hashCapture(sourceFilePath?: string): Promise<string> {
    if (!sourceFilePath) {
      return `missing-capture-${this.currentIndex}`;
    }

    const content = await readFile(sourceFilePath);
    return createHash("sha256").update(content).digest("hex").slice(0, 32);
  }

  private toActionResult(
    request: PlatformActionRequest,
    status: "success" | "skipped" | "failed",
    message: string,
    fallbackUsed: boolean,
    currentVideoId?: string,
    visualTarget?: VisualTarget | null,
    visualActionResult?: VisualActionResult | null,
    geometryStatus?: string | null,
  ): PlatformActionResult {
    return PlatformActionResultSchema.parse({
      actionId: request.actionId || createId("action"),
      platformId: this.platformId,
      type: request.type,
      status,
      target: request.target,
      message,
      createdAt: new Date().toISOString(),
      fallbackUsed,
      currentVideoId,
      geometryStatus: geometryStatus ?? null,
      visualTarget: visualTarget ?? null,
      visualActionResult: visualActionResult ?? null,
    });
  }
}