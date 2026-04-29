import type { BrowserActionResult, BrowserCaptureResult, BrowserController, BrowserGeometrySnapshot } from "../../browser/browser-controller.js";
import type { GeometryGuardAbilityGroup, GeometryGuardAbilityResult } from "../../../capabilities/geometry-guard/contract.js";
import type { MouseClickAbilityResult } from "../../../capabilities/mouse-click/contract.js";
import type { PageStateAbilityGroup } from "../../../capabilities/page-state/contract.js";
import type {
  PostActionActionProof,
  PostActionEvidenceRef,
  PostActionExpectedOutcome,
  PostActionObservation,
  PostActionVerificationAbilityResult,
} from "../../../capabilities/post-action-verification/contract.js";
import type { PlatformOperatorModeInfo, VideoOrientationMode } from "../platform-runtime-contract.js";
import type { VisualActionResult, VisualActionVerificationResult, VisualTarget } from "../../../types/visual-action.js";
import type { SuccessfulVisualTarget } from "../../../capabilities/visual-target/contract.js";
import type { TikTokPlatformVideo, TikTokRecentVideoIdentity } from "./identity.js";

export type ReadCurrentVideoInput = {
  browserController: BrowserController;
  pageStateAbilityGroup: PageStateAbilityGroup;
  captureBrowserRegion: (input: { regionLabel: string; contentLines?: string[] }) => Promise<BrowserCaptureResult>;
  startUrl: string;
  currentIndex: number;
  recentVideoIdentities: TikTokRecentVideoIdentity[];
};

export type ExecuteCoordinateActionInput = {
  browserController: BrowserController;
  geometryGuardAbilityGroup: GeometryGuardAbilityGroup;
  operatorModeInfo: PlatformOperatorModeInfo;
  updateOperatorModeInfo: (info: PlatformOperatorModeInfo) => void;
  setPageReadyStatus: (status: "review_required") => void;
  captureActionEvidence: (input: { regionLabel: string; contentLines?: string[] }) => Promise<{ browserActionId: string; regionType: string; createdAt: string }>;
  buildVisualTarget: (input: {
    targetType: VisualTarget["targetType"];
    boundingBox: NonNullable<VisualTarget["boundingBox"]>;
    clickPoint?: VisualTarget["clickPoint"] | null;
    confidence: number;
    sourceScreenshotEvidenceId: string;
    sourceCapturedAt?: string | null;
    detectionMethod: string;
    sourceAiResultRef?: string | null;
    sourceCandidateRef?: string | null;
    visibleText?: string | null;
    uncertainty?: string[];
    blockedReason?: string | null;
  }) => Promise<VisualTarget>;
  executeVisionCoordinateAction: (input: {
    actionType: "like_or_save_candidate" | "open_comments";
    target: SuccessfulVisualTarget;
    geometrySnapshot: BrowserGeometrySnapshot;
    guardResult: GeometryGuardAbilityResult;
  }) => Promise<{ browserResult: BrowserActionResult; governedClickResult: MouseClickAbilityResult | null }>;
  buildVisualActionResult: (input: {
    result: VisualActionResult["result"];
    afterEvidenceId?: string | null;
    verificationResult?: VisualActionVerificationResult | null;
    failureReason?: string | null;
    createdAt?: string;
  }) => VisualActionResult;
  actionType: "like_or_save_candidate" | "open_comments";
  targetLabel: string;
  targetType: "like_button" | "comments_button";
  box: (geometry: BrowserGeometrySnapshot) => { x: number; y: number; width: number; height: number };
  expectedOutcome: PostActionExpectedOutcome;
  verifyActionOutcome: (input: {
    actionProof: PostActionActionProof;
    beforeEvidence: PostActionEvidenceRef | null;
    afterEvidence: PostActionEvidenceRef;
    observations: PostActionObservation[];
  }) => Promise<PostActionVerificationAbilityResult>;
};

export type GovernedVisualActionExecution = {
  browserResult: BrowserActionResult;
  visualTarget: VisualTarget;
  visualActionResult: VisualActionResult;
  geometryStatus: string;
};

export type ReadCurrentVideoResult = Promise<TikTokPlatformVideo>;
