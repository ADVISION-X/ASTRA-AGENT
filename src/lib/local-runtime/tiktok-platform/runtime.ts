import type { BrowserController } from "../../browser/browser-controller.js";
import type {
  PlatformAdapter,
  PlatformCapabilityStatus,
  PlatformCapture,
  PlatformObservation,
  PlatformOperatorModeInfo,
  PlatformRuntimeDiagnostics,
  PlatformRuntimePageCapture,
  PlatformVideo,
  VideoOrientationMode,
} from "../platform-runtime-contract.js";
import { PlatformActionRequestSchema, type PlatformActionRequest, type PlatformActionResult } from "../../../types/platform-action.js";
import type { RuntimePageReadyStatus } from "../../../types/runtime.js";
import type { VisualActionResult, VisualTarget } from "../../../types/visual-action.js";
import type { PageStateAbilityGroup } from "../../../capabilities/page-state/contract.js";
import type { PostActionVerificationAbilityGroup } from "../../../capabilities/post-action-verification/contract.js";
import type { ScreenshotAbilityGroup } from "../../../capabilities/screenshot/contract.js";
import type { MouseClickAbilityGroup } from "../../../capabilities/mouse-click/contract.js";
import type { MouseScrollAbilityGroup } from "../../../capabilities/mouse-scroll/contract.js";
import type { VisualTargetAbilityGroup } from "../../../capabilities/visual-target/contract.js";
import { createGeometryGuardAbilityGroup } from "../../../capabilities/geometry-guard/ability-group.js";
import { VisionCoordinatePlatformAdapter } from "./vision-coordinate-runtime.js";
import { captureCommentRegion, captureVideoRegion, continueNext, likeOrSaveCandidate, observeCurrentVideo, openComments } from "./actions.js";
import { DEFAULT_TIKTOK_URL, TIKTOK_PLATFORM_ID, TikTokPlatformVideo, TikTokRecentVideoIdentity, resolveOrientationProfile } from "./identity.js";
import { executeCoordinateAction, readCurrentVideo, syncOperatorModeInfo } from "./coordinate-runtime.js";
import type { ExecuteCoordinateActionInput, GovernedVisualActionExecution } from "./runtime-types.js";
import { toPlatformActionResult, type PlatformActionResultInput } from "./result.js";
import { buildCapabilityStatus, buildRuntimeDiagnostics, captureRuntimePageState, createDefaultOperatorModeInfo } from "./view.js";

type CoordinateActionInput = Omit<ExecuteCoordinateActionInput, "browserController" | "geometryGuardAbilityGroup" | "operatorModeInfo" | "updateOperatorModeInfo" | "setPageReadyStatus" | "captureActionEvidence" | "buildVisualTarget" | "executeVisionCoordinateAction" | "buildVisualActionResult">;

export class TikTokPlatformAdapter extends VisionCoordinatePlatformAdapter implements PlatformAdapter {
  readonly defaultMaxRounds = 5;
  private readonly geometryGuardAbilityGroup = createGeometryGuardAbilityGroup();
  private currentIndex = 0;
  private currentVideo: TikTokPlatformVideo | null = null;
  private recentVideoIdentities: TikTokRecentVideoIdentity[] = [];
  private videoOrientation: VideoOrientationMode = "unknown";
  private pageReadyStatus: RuntimePageReadyStatus = "idle";
  private lastNavigationError: string | null = null;
  private operatorModeInfo: PlatformOperatorModeInfo = createDefaultOperatorModeInfo();

  constructor(browserController: BrowserController, screenshotAbilityGroup: ScreenshotAbilityGroup, visualTargetAbilityGroup: VisualTargetAbilityGroup, mouseClickAbilityGroup: MouseClickAbilityGroup, private readonly mouseScrollAbilityGroup: MouseScrollAbilityGroup, private readonly pageStateAbilityGroup: PageStateAbilityGroup, private readonly postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup, private readonly startUrl = DEFAULT_TIKTOK_URL) {
    super(browserController, screenshotAbilityGroup, visualTargetAbilityGroup, mouseClickAbilityGroup);
  }
  get platformId(): string { return TIKTOK_PLATFORM_ID; }
  getOperatorModeInfo(): PlatformOperatorModeInfo { return { ...this.operatorModeInfo }; }
  getRuntimeDiagnostics(): PlatformRuntimeDiagnostics { return buildRuntimeDiagnostics({ browserController: this.browserController, startUrl: this.startUrl, pageReadyStatus: this.pageReadyStatus, lastNavigationError: this.lastNavigationError }); }
  getCapabilityStatus(): PlatformCapabilityStatus[] { return buildCapabilityStatus({ operatorModeInfo: this.operatorModeInfo, videoOrientation: this.videoOrientation }); }
  setVideoOrientation(orientation: VideoOrientationMode): void {
    this.videoOrientation = orientation;
    this.operatorModeInfo.executionMode = "Vision-first Coordinate Mode";
    this.operatorModeInfo.orientation = orientation;
  }
  listVideos(): PlatformVideo[] { return this.currentVideo ? [this.currentVideo] : []; }
  async captureRuntimePageState(requestInput: PlatformActionRequest): Promise<PlatformRuntimePageCapture> { PlatformActionRequestSchema.parse(requestInput); return captureRuntimePageState({ browserController: this.browserController, captureBrowserRegion: (input) => this.captureActionEvidence(input), startUrl: this.startUrl, currentIndex: this.currentIndex, currentVideo: this.currentVideo }); }
  reset(): void { this.currentIndex = 0; this.currentVideo = null; this.recentVideoIdentities = []; this.videoOrientation = "unknown"; this.pageReadyStatus = "idle"; this.lastNavigationError = null; this.operatorModeInfo = createDefaultOperatorModeInfo(); }
  seek(index: number): void { this.currentIndex = Math.max(0, index); }
  hasCurrentVideo(): boolean { return this.currentIndex < this.defaultMaxRounds; }
  async prepareOpenedPage(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    this.pageReadyStatus = "waiting_page_ready";
    this.lastNavigationError = null;
    const session = this.browserController.getSessionState();
    const feedReadyState = await this.pageStateAbilityGroup.execute({
      childCapabilityId: "detect-feed-ready",
      currentUrl: session.currentUrl || this.startUrl,
      currentTitle: session.currentTitle,
      browserLoginState: session.loginState,
      observationRefs: [],
      sourceEvidenceRefs: [],
      requestedBy: "platform-action",
      sessionId: session.browserProfileRef || `page-state:${request.roundId}`,
      roundId: request.roundId,
      videoVisitId: null,
      confidencePolicy: { minimumConfidence: 0.72, allowReviewRequired: true },
      statePolicy: { allowReviewRequired: true, expectedPlatformHost: "www.tiktok.com", allowUnknownState: true },
    });
    if (feedReadyState.status !== "success" || feedReadyState.pageStateType !== "feed_ready") {
      this.pageReadyStatus = "review_required";
      this.lastNavigationError = feedReadyState.reviewRequiredReason ?? feedReadyState.stateSummary;
      return this.toActionResult({ request, status: "failed", message: feedReadyState.reviewRequiredReason ?? feedReadyState.stateSummary, fallbackUsed: false, currentVideoId: undefined, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined });
    }

    await this.refreshOperatorModeInfo();
    this.pageReadyStatus = "page_ready";
    return this.toActionResult({ request, status: "success", message: `platform page ready at ${this.browserController.getSessionState().currentUrl}`, fallbackUsed: false, currentVideoId: undefined, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined });
  }
  observeCurrentVideo(requestInput: PlatformActionRequest): Promise<PlatformObservation> { return observeCurrentVideo(this.createActionContext(), requestInput); }
  captureVideoRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture> { return captureVideoRegion(this.createActionContext(), requestInput); }
  async clickNotInterested(requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
    const request = PlatformActionRequestSchema.parse(requestInput);
    return this.toActionResult({
      request,
      status: "skipped",
      message: "tiktok not-interested action is not automated in phase 3 MVP",
      fallbackUsed: false,
      currentVideoId: this.currentVideo?.id,
      visualTarget: undefined,
      visualActionResult: undefined,
      geometryStatus: undefined,
    });
  }
  likeOrSaveCandidate(requestInput: PlatformActionRequest): Promise<PlatformActionResult> { return likeOrSaveCandidate(this.createActionContext(), requestInput); }
  openComments(requestInput: PlatformActionRequest): Promise<PlatformActionResult> { return openComments(this.createActionContext(), requestInput); }
  captureCommentRegion(requestInput: PlatformActionRequest): Promise<PlatformCapture> { return captureCommentRegion(this.createActionContext(), requestInput); }
  continueNext(requestInput: PlatformActionRequest): Promise<PlatformActionResult> { return continueNext(this.createActionContext(), requestInput); }
  async close(requestInput: PlatformActionRequest): Promise<PlatformActionResult> { const request = PlatformActionRequestSchema.parse(requestInput); const browserResult = await this.browserController.close(); return this.toActionResult({ request, status: browserResult.ok ? "success" : "failed", message: browserResult.message, fallbackUsed: browserResult.fallbackUsed, currentVideoId: undefined, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined }); }
  private createActionContext() { return { browserController: this.browserController, geometryGuardAbilityGroup: this.geometryGuardAbilityGroup, mouseScrollAbilityGroup: this.mouseScrollAbilityGroup, pageStateAbilityGroup: this.pageStateAbilityGroup, postActionVerificationAbilityGroup: this.postActionVerificationAbilityGroup, captureBrowserRegion: (input: { regionLabel: string; contentLines?: string[] }) => this.captureActionEvidence(input), startUrl: this.startUrl, getCurrentVideo: () => this.currentVideo, setCurrentVideo: (video: TikTokPlatformVideo | null) => { this.currentVideo = video; }, advanceCurrentIndex: () => { this.currentIndex += 1; }, requireCurrentVideo: () => this.requireCurrentVideo(), readCurrentVideo: () => this.readCurrentVideo(), getOrientationProfile: () => this.getOrientationProfile(), executeCoordinateAction: (input: CoordinateActionInput) => this.executeCoordinateAction(input), toActionResult: (input: Omit<PlatformActionResultInput, "platformId">) => this.toActionResult(input), setPageReadyStatus: (status: RuntimePageReadyStatus) => { this.pageReadyStatus = status; }, setLastNavigationError: (message: string | null) => { this.lastNavigationError = message; } }; }
  private readCurrentVideo(): Promise<TikTokPlatformVideo> { return readCurrentVideo({ browserController: this.browserController, pageStateAbilityGroup: this.pageStateAbilityGroup, captureBrowserRegion: (input: { regionLabel: string; contentLines?: string[] }) => this.captureActionEvidence(input), startUrl: this.startUrl, currentIndex: this.currentIndex, recentVideoIdentities: this.recentVideoIdentities }); }
  private async requireCurrentVideo(): Promise<TikTokPlatformVideo> { if (this.currentVideo) return this.currentVideo; const video = await this.readCurrentVideo(); this.currentVideo = video; return video; }
  private getOrientationProfile() { return resolveOrientationProfile(this.videoOrientation); }
  private async refreshOperatorModeInfo(): Promise<void> { await syncOperatorModeInfo({ browserController: this.browserController, setOperatorModeInfo: (info) => { this.operatorModeInfo = info; }, orientation: this.videoOrientation }); this.lastNavigationError = null; }
  private executeCoordinateAction(input: CoordinateActionInput): Promise<GovernedVisualActionExecution> { return executeCoordinateAction({ browserController: this.browserController, geometryGuardAbilityGroup: this.geometryGuardAbilityGroup, operatorModeInfo: this.operatorModeInfo, updateOperatorModeInfo: (info) => { this.operatorModeInfo = info; }, setPageReadyStatus: (status) => { this.pageReadyStatus = status; }, captureActionEvidence: (value) => this.captureActionEvidence(value), buildVisualTarget: (value) => this.buildVisualTarget(value), executeVisionCoordinateAction: (value) => this.executeVisionCoordinateAction(value), buildVisualActionResult: (value) => this.buildVisualActionResult(value), ...input }); }
  private toActionResult(input: Omit<PlatformActionResultInput, "platformId">): PlatformActionResult { return toPlatformActionResult({ platformId: this.platformId, ...input }); }
}