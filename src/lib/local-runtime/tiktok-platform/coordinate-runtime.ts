import { createId } from "../ids.js";
import type { BrowserActionResult, BrowserController, BrowserGeometrySnapshot } from "../../browser/browser-controller.js";
import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  type GeometryGuardAbilityInput,
  type GeometryGuardChildCapabilityId,
  type GeometryGuardCoordinateSpace,
} from "../../../capabilities/geometry-guard/contract.js";
import type { PageStateAbilityInput, PageStateAbilityResult } from "../../../capabilities/page-state/contract.js";
import type { PostActionVerificationAbilityResult } from "../../../capabilities/post-action-verification/contract.js";
import type { PlatformOperatorModeInfo, VideoOrientationMode } from "../platform-runtime-contract.js";
import type { VisualActionResult, VisualTarget } from "../../../types/visual-action.js";
import { isSuccessfulVisualTarget } from "../../../capabilities/visual-target/shared/target-validation.js";
import {
  createVisualSignature,
  extractTags,
  hashCaptureFile,
  MAX_RECENT_VIDEO_IDENTITIES,
  normalizeVideoId,
  REVIEW_REQUIRED_TAG,
  summarizeLoginState,
  TikTokPlatformVideo,
  TikTokRecentVideoIdentity,
  VISUAL_SIGNATURE_MATCH_DISTANCE,
  buildGeometryReadyOperatorModeInfo,
  hammingDistanceHex,
} from "./identity.js";
import type { ExecuteCoordinateActionInput, GovernedVisualActionExecution, ReadCurrentVideoInput } from "./runtime-types.js";

async function detectPageState(input: {
  currentUrl: string;
  currentTitle: string;
  browserLoginState: BrowserController["getSessionState"] extends () => infer TSession
    ? TSession extends { loginState: infer TLoginState }
      ? TLoginState
      : never
    : never;
  childCapabilityId: PageStateAbilityInput["childCapabilityId"];
  pageStateAbilityGroup: ReadCurrentVideoInput["pageStateAbilityGroup"];
  requestedBy: string;
  sessionId: string;
  roundId?: string | null;
  videoVisitId?: string | null;
  observationRefs?: PageStateAbilityInput["observationRefs"];
}): Promise<PageStateAbilityResult> {
  return input.pageStateAbilityGroup.execute({
    childCapabilityId: input.childCapabilityId,
    currentUrl: input.currentUrl,
    currentTitle: input.currentTitle,
    browserLoginState: input.browserLoginState,
    observationRefs: input.observationRefs ?? [],
    sourceEvidenceRefs: [],
    requestedBy: input.requestedBy,
    sessionId: input.sessionId,
    roundId: input.roundId ?? null,
    videoVisitId: input.videoVisitId ?? null,
    confidencePolicy: { minimumConfidence: 0.72, allowReviewRequired: true },
    statePolicy: { allowReviewRequired: true, expectedPlatformHost: "www.tiktok.com", allowUnknownState: true },
  });
}

export async function hashCapture(sourceFilePath: string | undefined, currentIndex: number): Promise<string> {
  return hashCaptureFile(sourceFilePath, currentIndex);
}
export function resolveCanonicalVideoId(input: {
  visualSignature: string;
  currentIndex: number;
  recentVideoIdentities: TikTokRecentVideoIdentity[];
}): string {
  const existingIdentity = input.recentVideoIdentities.find((candidate) => hammingDistanceHex(candidate.visualSignature, input.visualSignature) <= VISUAL_SIGNATURE_MATCH_DISTANCE);
  if (existingIdentity) {
    existingIdentity.visualSignature = input.visualSignature;
    return existingIdentity.id;
  }

  const id = normalizeVideoId({ visualSignature: input.visualSignature, roundIndex: input.currentIndex });
  input.recentVideoIdentities.unshift({ id, visualSignature: input.visualSignature });
  input.recentVideoIdentities.splice(MAX_RECENT_VIDEO_IDENTITIES);
  return id;
}
export async function readCurrentVideo(input: ReadCurrentVideoInput): Promise<TikTokPlatformVideo> {
  const session = input.browserController.getSessionState();
  const sessionId = session.browserProfileRef || `page-state:${input.currentIndex}`;
  const loginState = await detectPageState({
    childCapabilityId: "detect-login-state",
    currentUrl: session.currentUrl || input.startUrl,
    currentTitle: session.currentTitle,
    browserLoginState: session.loginState,
    pageStateAbilityGroup: input.pageStateAbilityGroup,
    requestedBy: "platform-action",
    sessionId,
  });
  const feedReadyState = await detectPageState({
    childCapabilityId: "detect-feed-ready",
    currentUrl: session.currentUrl || input.startUrl,
    currentTitle: session.currentTitle,
    browserLoginState: session.loginState,
    pageStateAbilityGroup: input.pageStateAbilityGroup,
    requestedBy: "platform-action",
    sessionId,
  });
  const pageAbnormality = await detectPageState({
    childCapabilityId: "detect-page-abnormality",
    currentUrl: session.currentUrl || input.startUrl,
    currentTitle: session.currentTitle,
    browserLoginState: session.loginState,
    pageStateAbilityGroup: input.pageStateAbilityGroup,
    requestedBy: "platform-action",
    sessionId,
  });
  const pageKind = await detectPageState({
    childCapabilityId: "detect-platform-page-kind",
    currentUrl: session.currentUrl || input.startUrl,
    currentTitle: session.currentTitle,
    browserLoginState: session.loginState,
    pageStateAbilityGroup: input.pageStateAbilityGroup,
    requestedBy: "platform-action",
    sessionId,
  });
  const capture = await input.captureBrowserRegion({
    regionLabel: "current-video-identification",
    contentLines: [session.currentUrl || input.startUrl, loginState.stateSummary],
  });
  const screenshotHash = await hashCapture(capture.sourceFilePath, input.currentIndex);
  const visualSignature = await createVisualSignature(capture.sourceFilePath);
  const canonicalVideoId = resolveCanonicalVideoId({
    visualSignature,
    currentIndex: input.currentIndex,
    recentVideoIdentities: input.recentVideoIdentities,
  });

  const requiresReview = loginState.status !== "success"
    || feedReadyState.status !== "success"
    || pageAbnormality.status !== "success"
    || feedReadyState.pageStateType !== "feed_ready"
    || pageAbnormality.pageStateType === "page_abnormal";

  if (requiresReview) {
    const reviewReason = feedReadyState.reviewRequiredReason
      ?? pageAbnormality.reviewRequiredReason
      ?? loginState.reviewRequiredReason
      ?? feedReadyState.stateSummary;
    return {
      id: canonicalVideoId,
      title: session.currentTitle || "TikTok review required",
      pageUrl: session.currentUrl || input.startUrl,
      summary: reviewReason,
      tags: [
        "uncertain",
        REVIEW_REQUIRED_TAG,
        loginState.pageStateType,
        feedReadyState.pageStateType,
        pageAbnormality.pageStateType,
      ],
      comments: [],
      screenshotHash,
      visualSignature,
    };
  }

  return {
    id: canonicalVideoId,
    title: session.currentTitle || `TikTok visual round ${input.currentIndex + 1}`,
    pageUrl: session.currentUrl || input.startUrl,
    summary: `visual video capture ${screenshotHash.slice(0, 32)}`,
    tags: extractTags([session.currentUrl || input.startUrl, loginState.stateSummary, pageKind.stateSummary]),
    comments: [],
    screenshotHash,
    visualSignature,
  };
}
export function createBrowserFailureResult(message: string): BrowserActionResult {
  return { browserActionId: createId("browser"), ok: false, message, createdAt: new Date().toISOString(), fallbackUsed: false };
}
async function buildGuardBlockedExecution(input: ExecuteCoordinateActionInput, geometry: BrowserGeometrySnapshot, reason: string, geometryStatus: string): Promise<GovernedVisualActionExecution> {
  input.setPageReadyStatus("review_required");
  input.updateOperatorModeInfo({
    ...input.operatorModeInfo,
    geometryGuard: geometryStatus === "block" ? "Execution blocked" : "Review required",
    calibration: reason,
  });
  const blockedTarget = await input.buildVisualTarget({
    targetType: input.targetType,
    boundingBox: input.box(geometry),
    confidence: 0,
    sourceScreenshotEvidenceId: createId("visual_target_blocked"),
    detectionMethod: "geometry_guard_block",
    sourceCandidateRef: `${input.targetType}-geometry-guard-blocked`,
    uncertainty: [reason],
    blockedReason: reason,
  });
  return {
    browserResult: createBrowserFailureResult(reason),
    visualTarget: blockedTarget,
    visualActionResult: input.buildVisualActionResult({
      result: "review_required",
      failureReason: reason,
    }),
    geometryStatus,
  };
}
async function buildHeuristicVisualTarget(input: ExecuteCoordinateActionInput, geometry: BrowserGeometrySnapshot): Promise<VisualTarget> {
  const boundingBox = input.box(geometry);
  const beforeCapture = await input.captureActionEvidence({
    regionLabel: `${input.targetType}-pre-action`,
    contentLines: ["mode: vision-first-coordinate", `target: ${input.targetType}`, `viewport: ${geometry.viewportWidth}x${geometry.viewportHeight}`],
  });
  return input.buildVisualTarget({
    targetType: input.targetType,
    boundingBox,
    clickPoint: {
      x: boundingBox.x + boundingBox.width / 2,
      y: boundingBox.y + boundingBox.height / 2,
    },
    confidence: 0.76,
    sourceScreenshotEvidenceId: beforeCapture.browserActionId,
    detectionMethod: "heuristic_viewport_box",
    sourceCandidateRef: `${input.targetType}-heuristic-profile`,
    uncertainty: ["heuristic viewport target pending model-backed visual target detection"],
  });
}
function finalizeCoordinateExecution(input: {
  coordinateResult: BrowserActionResult;
  geometryStatus: string;
  targetLabel: string;
  verificationResult: PostActionVerificationAbilityResult | null;
  visualActionResult: VisualActionResult;
  visualTarget: VisualTarget;
}): GovernedVisualActionExecution {
  return {
    browserResult: input.coordinateResult,
    visualTarget: input.visualTarget,
    visualActionResult: input.visualActionResult,
    geometryStatus: input.geometryStatus,
  };
}

function toGeometryGuardCoordinateSpace(target: VisualTarget): GeometryGuardCoordinateSpace {
  switch (target.coordinateSpace) {
    case "browser_viewport":
      return "browserViewport";
    case "desktop_screen":
      return "desktopScreen";
    case "source_image":
      return "imageEvidence";
    case "ai_input":
      return "aiInput";
    case "contact_sheet":
      return "contactSheet";
    default:
      return "regionCrop";
  }
}

function selectGeometryGuardChildCapabilityId(space: GeometryGuardCoordinateSpace): GeometryGuardChildCapabilityId {
  switch (space) {
    case "browserViewport":
      return "validate-browser-viewport-bounds";
    case "desktopScreen":
      return "validate-desktop-screen-bounds";
    case "aiInput":
      return "map-ai-input-to-viewport";
    case "imageEvidence":
    case "regionCrop":
      return "map-region-to-source";
    case "contactSheet":
      return "validate-coordinate-space";
  }
}

function buildGeometryGuardInput(input: ExecuteCoordinateActionInput, target: VisualTarget, geometry: BrowserGeometrySnapshot): GeometryGuardAbilityInput {
  const sourceCoordinateSpace = toGeometryGuardCoordinateSpace(target);
  const requestedExecutionSpace = sourceCoordinateSpace === "desktopScreen" ? "desktopScreen" : "browserViewport";
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: selectGeometryGuardChildCapabilityId(sourceCoordinateSpace),
    sessionId: target.sourceScreenshotEvidenceId,
    roundId: null,
    videoVisitId: null,
    requestedBy: "platform-action",
    purpose: `${input.actionType}:${input.targetType}`,
    sourceScreenshotEvidenceRef: target.sourceScreenshotEvidenceId,
    sourceTargetRef: target.targetId,
    sourceAiResultRef: target.sourceAiResultRef,
    sourceCoordinateSpace,
    requestedExecutionSpace,
    bbox: target.boundingBox,
    clickPoint: target.clickPoint,
    imageSize: { width: geometry.screenshotWidth, height: geometry.screenshotHeight },
    viewportSize: { width: geometry.viewportWidth, height: geometry.viewportHeight },
    screenSize: { width: geometry.screenshotWidth, height: geometry.screenshotHeight },
    deviceScaleFactor: geometry.scaleFactor,
    scaleMapping: null,
    safetyPolicy: {
      allowReviewRequired: true,
      minimumConfidence: 0.72,
      coordinateConfidence: target.confidence,
      requireSourceRef: true,
    },
    dataQualityFlags: [...target.dataQualityFlags],
  };
}

export async function syncOperatorModeInfo(input: {
  browserController: BrowserController;
  setOperatorModeInfo: (info: PlatformOperatorModeInfo) => void;
  orientation: VideoOrientationMode;
}): Promise<void> {
  const geometry = await input.browserController.getGeometrySnapshot();
  input.setOperatorModeInfo(buildGeometryReadyOperatorModeInfo({ geometry, orientation: input.orientation }));
}

export async function executeCoordinateAction(input: ExecuteCoordinateActionInput): Promise<GovernedVisualActionExecution> {
  const geometry = await input.browserController.getGeometrySnapshot();
  const target = await buildHeuristicVisualTarget(input, geometry);
  if (!isSuccessfulVisualTarget(target)) {
    return {
      browserResult: createBrowserFailureResult(target.failureReason ?? `${input.targetLabel} visual target normalization failed`),
      visualTarget: target,
      visualActionResult: input.buildVisualActionResult({
        result: target.status,
        failureReason: target.failureReason ?? `${input.targetLabel} visual target normalization failed`,
      }),
      geometryStatus: "review_required",
    };
  }

  const guardResult = await input.geometryGuardAbilityGroup.execute(buildGeometryGuardInput(input, target, geometry));
  if (guardResult.status !== "success" || guardResult.guardDecision !== "allow") {
    return buildGuardBlockedExecution(input, geometry, guardResult.statusMessage, guardResult.guardDecision);
  }

  const coordinateResult = await input.executeVisionCoordinateAction({
    actionType: input.actionType,
    target,
    geometrySnapshot: geometry,
    guardResult,
  }).catch((error: unknown) => createBrowserFailureResult(error instanceof Error ? error.message : String(error)));
  const afterCapture = await input.captureActionEvidence({
    regionLabel: `${input.targetType}-post-action`,
    contentLines: [`target: ${input.targetType}`, `coordinate-click-attempted: ${coordinateResult.ok ? "yes" : "no"}`],
  });
  const verificationResult = coordinateResult.ok
    ? await input.verifyActionOutcome({
      actionLogRef: coordinateResult.browserActionId,
      beforeEvidenceRef: target.sourceScreenshotEvidenceId,
      afterCapture,
      observationRefs: [
        {
          kind: "action_completion",
          ref: coordinateResult.browserActionId,
          payload: {
            ok: coordinateResult.ok,
            targetType: input.targetType,
          },
        },
      ],
    })
    : null;
  const visualActionResult = input.buildVisualActionResult({
    result: !coordinateResult.ok
      ? "failed"
      : verificationResult?.verificationDecision === "verified"
        ? "success"
        : verificationResult?.verificationDecision === "review_required"
          ? "review_required"
          : "failed",
    afterEvidenceId: afterCapture.browserActionId,
    verificationResult,
    failureReason: !coordinateResult.ok
      ? coordinateResult.message
      : verificationResult?.verificationDecision === "verified"
        ? null
        : verificationResult?.reviewRequiredReason ?? verificationResult?.failureReason ?? `${input.targetLabel} post-action verification failed`,
  });

  return finalizeCoordinateExecution({
    coordinateResult,
    geometryStatus: guardResult.guardDecision,
    targetLabel: input.targetLabel,
    verificationResult,
    visualActionResult,
    visualTarget: target,
  });
}