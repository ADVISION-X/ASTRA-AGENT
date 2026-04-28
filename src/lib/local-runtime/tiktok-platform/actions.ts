import type { BrowserCaptureResult, BrowserController } from "../../browser/browser-controller.js";
import type { GeometryGuardAbilityGroup } from "../../../capabilities/geometry-guard/contract.js";
import type { PostActionVerificationAbilityGroup } from "../../../capabilities/post-action-verification/contract.js";
import { MOUSE_SCROLL_ABILITY_GROUP_ID, type MouseScrollAbilityGroup, type MouseScrollAbilityResult } from "../../../capabilities/mouse-scroll/contract.js";
import type { PageStateAbilityGroup } from "../../../capabilities/page-state/contract.js";
import type { PlatformCapture, PlatformObservation } from "../platform-runtime-contract.js";
import { PlatformActionRequestSchema, type PlatformActionRequest, type PlatformActionResult } from "../../../types/platform-action.js";
import {
  NEXT_VIDEO_CONFIRMATION_DISTANCE,
  type OrientationCoordinateProfile,
  TikTokPlatformVideo,
  hammingDistanceHex,
} from "./identity.js";
import type { ExecuteCoordinateActionInput, GovernedVisualActionExecution } from "./runtime-types.js";
import type { PlatformActionResultInput } from "./result.js";

type CoordinateActionContextInput = Omit<ExecuteCoordinateActionInput, "browserController" | "geometryGuardAbilityGroup" | "operatorModeInfo" | "updateOperatorModeInfo" | "setPageReadyStatus" | "captureActionEvidence" | "buildVisualTarget" | "executeVisionCoordinateAction" | "buildVisualActionResult">;

type TikTokActionContext = {
  browserController: BrowserController;
  geometryGuardAbilityGroup: GeometryGuardAbilityGroup;
  mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  pageStateAbilityGroup: PageStateAbilityGroup;
  captureBrowserRegion: (input: { regionLabel: string; contentLines?: string[] }) => Promise<BrowserCaptureResult>;
  startUrl: string;
  getCurrentVideo: () => TikTokPlatformVideo | null;
  setCurrentVideo: (video: TikTokPlatformVideo | null) => void;
  advanceCurrentIndex: () => void;
  requireCurrentVideo: () => Promise<TikTokPlatformVideo>;
  readCurrentVideo: () => Promise<TikTokPlatformVideo>;
  getOrientationProfile: () => OrientationCoordinateProfile;
  executeCoordinateAction: (input: CoordinateActionContextInput) => Promise<GovernedVisualActionExecution>;
  postActionVerificationAbilityGroup: PostActionVerificationAbilityGroup;
  toActionResult: (input: Omit<PlatformActionResultInput, "platformId">) => PlatformActionResult;
  setPageReadyStatus: (status: "opening_target_page" | "waiting_page_ready" | "page_ready" | "navigation_failed" | "review_required") => void;
  setLastNavigationError: (message: string | null) => void;
};
export async function observeCurrentVideo(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformObservation> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  await context.browserController.wait(1500);
  const video = await context.readCurrentVideo();
  context.setCurrentVideo(video);
  return {
    platformId: "tiktok-web",
    video,
    actionResult: context.toActionResult({ request, status: "success", message: `observed ${video.id}`, fallbackUsed: false, currentVideoId: video.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined }),
  };
}
export async function captureVideoRegion(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformCapture> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  const video = await context.requireCurrentVideo();
  const capture = await context.captureBrowserRegion({
    regionLabel: "video-region",
    contentLines: [video.title, video.summary, `tags: ${video.tags.join(", ")}`],
  });
  return {
    platformId: "tiktok-web",
    video,
    capture,
    actionResult: context.toActionResult({ request, status: "success", message: `captured video region for ${video.id}`, fallbackUsed: false, currentVideoId: video.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined }),
  };
}
export async function likeOrSaveCandidate(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  const profile = context.getOrientationProfile();
  const sessionId = context.browserController.getSessionState().browserProfileRef || `platform-action:${request.roundId}`;
  const execution = await context.executeCoordinateAction({
    actionType: "like_or_save_candidate",
    targetLabel: "like candidate",
    targetType: "like_button",
    box: (geometry: Parameters<typeof profile.like_button>[0]) => profile.like_button(geometry),
    expectedOutcome: {
      outcomeType: "target_state_changed",
      description: "like or save marker state changes after click",
      expectedUrlHost: null,
      expectedUrlPrefix: null,
      expectedState: "marker_changed",
      expectedTargetType: "like_button",
      requiresBeforeAfterComparison: true,
      requiresVisualEvidence: true,
    },
    verifyActionOutcome: async ({ actionLogRef, beforeEvidenceRef, afterCapture, observationRefs }) =>
      context.postActionVerificationAbilityGroup.execute({
        childCapabilityId: "verify-target-state-changed",
        actionLogRef,
        sourceAbilityGroupId: "mouse-click",
        sourceActionType: "like_or_save_candidate",
        expectedOutcome: {
          outcomeType: "target_state_changed",
          description: "like or save marker state changes after click",
          expectedUrlHost: null,
          expectedUrlPrefix: null,
          expectedState: "marker_changed",
          expectedTargetType: "like_button",
          requiresBeforeAfterComparison: true,
          requiresVisualEvidence: true,
        },
        beforeEvidenceRef,
        afterEvidenceRef: afterCapture.browserActionId,
        pageStateRef: null,
        aiObservationRef: null,
        visualTargetRef: null,
        screenshotDiffRef: null,
        requestedBy: "platform-action",
        sessionId,
        roundId: request.roundId,
        videoVisitId: context.getCurrentVideo()?.id ?? null,
        confidencePolicy: { minimumConfidence: 0.72, allowReviewRequired: true },
        verificationPolicy: {
          verificationMode: "before_after_comparison",
          requireAfterEvidence: true,
          requireBeforeAfterComparison: true,
          allowSelfReportedSuccess: false,
        },
        observationRefs,
      }),
  });
  return context.toActionResult({
    request,
    status: execution.browserResult.ok ? "success" : "failed",
    message: execution.browserResult.message,
    fallbackUsed: execution.browserResult.fallbackUsed,
    currentVideoId: context.getCurrentVideo()?.id,
    visualTarget: execution.visualTarget,
    visualActionResult: execution.visualActionResult,
    geometryStatus: execution.geometryStatus,
  });
}
export async function openComments(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  const profile = context.getOrientationProfile();
  const sessionId = context.browserController.getSessionState().browserProfileRef || `platform-action:${request.roundId}`;
  const execution = await context.executeCoordinateAction({
    actionType: "open_comments",
    targetLabel: "open comments",
    targetType: "comments_button",
    box: (geometry: Parameters<typeof profile.comments_button>[0]) => profile.comments_button(geometry),
    expectedOutcome: {
      outcomeType: "comments_panel_opened",
      description: "comments panel becomes visible after click",
      expectedUrlHost: null,
      expectedUrlPrefix: null,
      expectedState: "comments_panel_open",
      expectedTargetType: "comments_panel",
      requiresBeforeAfterComparison: false,
      requiresVisualEvidence: true,
    },
    verifyActionOutcome: async ({ actionLogRef, beforeEvidenceRef, afterCapture, observationRefs }) =>
      context.postActionVerificationAbilityGroup.execute({
        childCapabilityId: "verify-comments-panel-opened",
        actionLogRef,
        sourceAbilityGroupId: "mouse-click",
        sourceActionType: "open_comments",
        expectedOutcome: {
          outcomeType: "comments_panel_opened",
          description: "comments panel becomes visible after click",
          expectedUrlHost: null,
          expectedUrlPrefix: null,
          expectedState: "comments_panel_open",
          expectedTargetType: "comments_panel",
          requiresBeforeAfterComparison: false,
          requiresVisualEvidence: true,
        },
        beforeEvidenceRef,
        afterEvidenceRef: afterCapture.browserActionId,
        pageStateRef: null,
        aiObservationRef: null,
        visualTargetRef: null,
        screenshotDiffRef: null,
        requestedBy: "platform-action",
        sessionId,
        roundId: request.roundId,
        videoVisitId: context.getCurrentVideo()?.id ?? null,
        confidencePolicy: { minimumConfidence: 0.72, allowReviewRequired: true },
        verificationPolicy: {
          verificationMode: "visual_evidence",
          requireAfterEvidence: true,
          requireBeforeAfterComparison: false,
          allowSelfReportedSuccess: false,
        },
        observationRefs,
      }),
  });
  return context.toActionResult({
    request,
    status: execution.browserResult.ok ? "success" : "failed",
    message: execution.browserResult.message,
    fallbackUsed: execution.browserResult.fallbackUsed,
    currentVideoId: context.getCurrentVideo()?.id,
    visualTarget: execution.visualTarget,
    visualActionResult: execution.visualActionResult,
    geometryStatus: execution.geometryStatus,
  });
}
export async function captureCommentRegion(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformCapture> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  const video = await context.requireCurrentVideo();
  const capture = await context.captureBrowserRegion({
    regionLabel: "comment-region",
    contentLines: ["visual comment capture", video.id],
  });
  return {
    platformId: "tiktok-web",
    video: {
      ...video,
      comments: video.comments,
    },
    capture,
    actionResult: context.toActionResult({ request, status: "success", message: `captured comment region for ${video.id}`, fallbackUsed: false, currentVideoId: video.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined }),
  };
}

type ContinueNextState = {
  latestVideoId: string;
  latestDistance: number | null;
  lastVerificationMessage: string | null;
};
const createContinueNextState = (previousVideo: TikTokPlatformVideo): ContinueNextState => ({
  latestVideoId: previousVideo.id,
  latestDistance: null,
  lastVerificationMessage: null,
});
type NextVideoAttemptResult = {
  observedVideo: TikTokPlatformVideo;
  scrollResult: MouseScrollAbilityResult | null;
  failureMessage: string | null;
};

const approveFeedScrollGeometry = async (context: TikTokActionContext, previousVideo: TikTokPlatformVideo) => {
  const geometry = await context.browserController.getGeometrySnapshot();
  const viewportBounds = {
    width: geometry.viewportWidth,
    height: geometry.viewportHeight,
  };
  const bbox = geometry.visibleContentBounds.width > 0 && geometry.visibleContentBounds.height > 0
    ? geometry.visibleContentBounds
    : { x: 0, y: 0, width: geometry.viewportWidth, height: geometry.viewportHeight };
  const anchorPoint = {
    x: Math.round(bbox.x + bbox.width / 2),
    y: Math.round(bbox.y + bbox.height / 2),
  };
  const guardResult = await context.geometryGuardAbilityGroup.execute({
    abilityGroupId: "geometry-guard",
    childCapabilityId: "validate-browser-viewport-bounds",
    sessionId: `platform-scroll:${previousVideo.id}`,
    roundId: null,
    videoVisitId: previousVideo.id,
    requestedBy: "platform-action",
    purpose: "approve_continue_next_scroll",
    sourceScreenshotEvidenceRef: null,
    sourceTargetRef: "feed_scroll_area",
    sourceAiResultRef: null,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox,
    clickPoint: anchorPoint,
    imageSize: null,
    viewportSize: viewportBounds,
    screenSize: null,
    deviceScaleFactor: geometry.scaleFactor,
    scaleMapping: null,
    safetyPolicy: {
      allowReviewRequired: true,
      minimumConfidence: null,
      coordinateConfidence: null,
      requireSourceRef: false,
    },
    dataQualityFlags: [],
  });

  if (guardResult.status !== "success" || guardResult.guardDecision !== "allow" || !guardResult.normalizedClickPoint) {
    return {
      ok: false as const,
      message: guardResult.statusMessage,
    };
  }

  return {
    ok: true as const,
    geometryGuardRef: guardResult.geometryGuardRef,
    anchorPoint: guardResult.normalizedClickPoint,
    bounds: viewportBounds,
    coordinateSpace: guardResult.normalizedCoordinateSpace,
  };
};

const performNextVideoAttempt = async (context: TikTokActionContext, previousVideo: TikTokPlatformVideo, state: ContinueNextState): Promise<NextVideoAttemptResult> => {
  const geometryApproval = await approveFeedScrollGeometry(context, previousVideo);
  if (!geometryApproval.ok || geometryApproval.coordinateSpace !== "browserViewport") {
    return {
      observedVideo: previousVideo,
      scrollResult: null,
      failureMessage: geometryApproval.message ?? "Geometry Guard did not approve browser viewport scroll",
    };
  }

  const scrollResult = await context.mouseScrollAbilityGroup.execute({
    abilityGroupId: MOUSE_SCROLL_ABILITY_GROUP_ID,
    childCapabilityId: "scroll-browser-viewport",
    sessionId: `platform-scroll:${previousVideo.id}`,
    roundId: null,
    videoVisitId: previousVideo.id,
    requestedBy: "platform-action",
    purpose: "continue_discovery",
    geometryGuardRef: geometryApproval.geometryGuardRef,
    guardDecision: "allow",
    sourceEvidenceRef: null,
    sourceTargetRef: "feed_scroll_area",
    coordinateSpace: "browserViewport",
    anchorPoint: geometryApproval.anchorPoint,
    region: null,
    regionRef: null,
    bounds: geometryApproval.bounds,
    direction: "down",
    magnitude: "onePage",
    customDelta: null,
    repeat: 1,
    safetyPolicy: {
      allowOperatorManual: false,
      operatorManualApprovalRef: null,
      maxRepeat: 3,
      maxDeltaAbs: geometryApproval.bounds.height * 2,
      maxDurationMs: 3000,
      blockIfOutOfBounds: true,
      blockIfNoSourceRef: false,
    },
  });
  await context.browserController.wait(1200);
  const observedVideo = await context.readCurrentVideo();
  state.latestVideoId = observedVideo.id;
  state.latestDistance = hammingDistanceHex(observedVideo.visualSignature, previousVideo.visualSignature);
  return {
    observedVideo,
    scrollResult,
    failureMessage: null,
  };
};
const confirmNextVideo = async (context: TikTokActionContext, previousVideo: TikTokPlatformVideo, observedVideo: TikTokPlatformVideo): Promise<TikTokPlatformVideo | null> => {
  if (observedVideo.id === previousVideo.id || hammingDistanceHex(observedVideo.visualSignature, previousVideo.visualSignature) < NEXT_VIDEO_CONFIRMATION_DISTANCE) {
    return null;
  }

  await context.browserController.wait(900);
  const confirmedVideo = await context.readCurrentVideo();
  const confirmedDistance = hammingDistanceHex(confirmedVideo.visualSignature, previousVideo.visualSignature);
  return confirmedVideo.id === observedVideo.id && confirmedDistance >= NEXT_VIDEO_CONFIRMATION_DISTANCE ? confirmedVideo : null;
};
export async function continueNext(context: TikTokActionContext, requestInput: PlatformActionRequest): Promise<PlatformActionResult> {
  const request = PlatformActionRequestSchema.parse(requestInput);
  const previousVideo = await context.requireCurrentVideo();
  const sessionId = context.browserController.getSessionState().browserProfileRef || `platform-action:${request.roundId}`;
  context.advanceCurrentIndex();
  const state = createContinueNextState(previousVideo);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { observedVideo, scrollResult, failureMessage } = await performNextVideoAttempt(context, previousVideo, state);
    if (!scrollResult) {
      context.setCurrentVideo(previousVideo);
      return context.toActionResult({ request, status: "failed", message: failureMessage ?? "Mouse Scroll could not obtain Geometry Guard approval", fallbackUsed: false, currentVideoId: previousVideo.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined });
    }

    if (scrollResult.status !== "success") {
      context.setCurrentVideo(previousVideo);
      return context.toActionResult({ request, status: "failed", message: scrollResult.statusMessage, fallbackUsed: false, currentVideoId: previousVideo.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined });
    }

    const confirmedVideo = await confirmNextVideo(context, previousVideo, observedVideo);
    const afterVideo = confirmedVideo ?? observedVideo;
    const verificationResult = await context.postActionVerificationAbilityGroup.execute({
      childCapabilityId: "verify-video-changed-after-scroll",
      actionLogRef: scrollResult.scrollExecutionRef,
      sourceAbilityGroupId: "mouse-scroll",
      sourceActionType: "continue_next",
      expectedOutcome: {
        outcomeType: "video_changed_after_scroll",
        description: "current video changes after scroll",
        expectedUrlHost: null,
        expectedUrlPrefix: null,
        expectedState: "video_changed",
        expectedTargetType: "next_video_region",
        requiresBeforeAfterComparison: true,
        requiresVisualEvidence: false,
      },
      beforeEvidenceRef: null,
      afterEvidenceRef: null,
      pageStateRef: null,
      aiObservationRef: null,
      visualTargetRef: null,
      screenshotDiffRef: null,
      requestedBy: "platform-action",
      sessionId,
      roundId: request.roundId,
      videoVisitId: previousVideo.id,
      confidencePolicy: { minimumConfidence: 0.8, allowReviewRequired: true },
      verificationPolicy: {
        verificationMode: "before_after_comparison",
        requireAfterEvidence: false,
        requireBeforeAfterComparison: false,
        allowSelfReportedSuccess: false,
      },
      observationRefs: [
        {
          kind: "video_identity",
          ref: `${request.actionId}:before-video`,
          payload: {
            role: "before",
            videoId: previousVideo.id,
            visualSignature: previousVideo.visualSignature,
          },
        },
        {
          kind: "video_identity",
          ref: `${request.actionId}:after-video:${attempt}`,
          payload: {
            role: "after",
            videoId: afterVideo.id,
            visualSignature: afterVideo.visualSignature,
            confirmed: confirmedVideo !== null,
          },
        },
      ],
    });
    state.lastVerificationMessage = verificationResult.reviewRequiredReason ?? verificationResult.failureReason ?? verificationResult.observedOutcome;
    if (verificationResult.verificationDecision === "verified" && confirmedVideo) {
      context.setCurrentVideo(confirmedVideo);
      const message = attempt === 1 ? `scrolled forward to ${confirmedVideo.id}` : `scroll retry ${attempt} reached ${confirmedVideo.id}`;
      return context.toActionResult({ request, status: "success", message, fallbackUsed: false, currentVideoId: confirmedVideo.id, visualTarget: undefined, visualActionResult: undefined, geometryStatus: undefined });
    }
  }

  context.setCurrentVideo(previousVideo);
  return context.toActionResult({
    request,
    status: "failed",
    message: state.lastVerificationMessage ?? `scroll did not advance to a confirmed new video after 5 attempts; previous videoVisitId=${previousVideo.id}; current videoVisitId=${state.latestVideoId}; lastVisualDistance=${state.latestDistance ?? "unknown"}`,
    fallbackUsed: false,
    currentVideoId: state.latestVideoId,
    visualTarget: undefined,
    visualActionResult: undefined,
    geometryStatus: undefined,
  });
}