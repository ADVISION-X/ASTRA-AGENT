import type { BrowserController, BrowserGeometrySnapshot } from "../../browser/browser-controller.js";
import type { GeometryGuardAbilityResult } from "../../../capabilities/geometry-guard/contract.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID, type MouseClickAbilityGroup, type MouseClickAbilityInput } from "../../../capabilities/mouse-click/contract.js";
import type { ScreenshotAbilityGroup } from "../../../capabilities/screenshot/contract.js";
import type {
  SuccessfulVisualTarget,
  VisualBoundingBox,
  VisualTargetChildCapabilityId,
  VisualClickPoint,
  VisualTargetNature,
  VisualTarget,
  VisualTargetAbilityGroup,
  VisualTargetType,
} from "../../../capabilities/visual-target/contract.js";
import type { PlatformActionType } from "../../../types/platform-action.js";
import { VisualActionResultSchema, type VisualActionResult, type VisualActionVerificationResult } from "../../../types/visual-action.js";
import { createId } from "../ids.js";

const TARGET_TYPE_TO_CHILD_CAPABILITY_ID: Partial<Record<VisualTargetType, VisualTargetChildCapabilityId>> = {
  comments_button: "detect-comments-button",
  not_interested_button: "detect-not-interested-button",
  next_video_region: "detect-next-video-region",
  like_button: "detect-like-button",
  save_button: "detect-save-button",
  comments_panel: "detect-comments-panel",
  close_comments_button: "detect-close-comments-button",
  metric_like_count: "detect-metric-like-count",
  metric_comment_count: "detect-metric-comment-count",
};

const TARGET_TYPE_TO_NATURE: Record<VisualTargetType, VisualTargetNature> = {
  like_button: "action",
  save_button: "action",
  comments_button: "action",
  comments_panel: "region",
  close_comments_button: "action",
  not_interested_button: "action",
  next_video_region: "region",
  metric_like_count: "metric",
  metric_comment_count: "metric",
};

const TARGET_TYPE_TO_PAGE_STATE_TYPE: Record<VisualTargetType, string> = {
  like_button: "platform_feed",
  save_button: "platform_feed",
  comments_button: "platform_feed",
  comments_panel: "comments_panel",
  close_comments_button: "comments_panel",
  not_interested_button: "platform_feed",
  next_video_region: "platform_feed",
  metric_like_count: "platform_feed",
  metric_comment_count: "platform_feed",
};

export abstract class VisionCoordinatePlatformAdapter {
  protected readonly screenshotAbilityGroup: ScreenshotAbilityGroup;
  protected readonly mouseClickAbilityGroup: MouseClickAbilityGroup;
  protected readonly visualTargetAbilityGroup: VisualTargetAbilityGroup;

  constructor(
    protected readonly browserController: BrowserController,
    screenshotAbilityGroup: ScreenshotAbilityGroup,
    visualTargetAbilityGroup: VisualTargetAbilityGroup,
    mouseClickAbilityGroup: MouseClickAbilityGroup,
  ) {
    this.screenshotAbilityGroup = screenshotAbilityGroup;
    this.visualTargetAbilityGroup = visualTargetAbilityGroup;
    this.mouseClickAbilityGroup = mouseClickAbilityGroup;
  }

  protected async captureActionEvidence(input: {
    regionLabel: string;
    contentLines?: string[];
  }) {
    const result = await this.screenshotAbilityGroup.captureBrowserViewport({
      sessionId: "platform-capture",
      roundId: null,
      videoVisitId: null,
      requestedBy: "orchestration",
      purpose: input.regionLabel,
      maxAiWidth: null,
      preservePixels: true,
      evidencePolicy: "evidence_original",
      contentLines: input.contentLines ?? [],
    });
    if (result.status !== "success" || !result.output) {
      throw new Error(result.failureReason?.message ?? `screenshot capture failed for ${input.regionLabel}`);
    }
    return {
      browserActionId: result.runtimeProof.proofId,
      pageUrl: result.output.pageUrl ?? "about:blank",
      pageTitle: result.output.pageTitle ?? "",
      regionLabel: result.output.regionLabel,
      regionType: result.output.regionType,
      width: result.output.width,
      height: result.output.height,
      contentLines: result.output.contentLines,
      sourceFilePath: result.output.artifactRef.storageRef,
      createdAt: result.output.artifactRef.createdAt,
    };
  }

  protected async executeVisionCoordinateAction(input: {
    actionType: PlatformActionType;
    target: SuccessfulVisualTarget;
    geometrySnapshot: BrowserGeometrySnapshot;
    guardResult: GeometryGuardAbilityResult;
  }) {
    if (input.guardResult.status !== "success" || input.guardResult.guardDecision !== "allow" || !input.guardResult.normalizedClickPoint || !input.guardResult.normalizedCoordinateSpace) {
      throw new Error(input.guardResult.failureReason ?? input.guardResult.statusMessage);
    }
    const childCapabilityId = input.guardResult.normalizedCoordinateSpace === "browserViewport"
      ? "click-browser-coordinate"
      : "click-desktop-coordinate";
    const executionWidth = input.guardResult.normalizedCoordinateSpace === "browserViewport"
      ? input.geometrySnapshot.viewportWidth
      : input.geometrySnapshot.screenshotWidth;
    const executionHeight = input.guardResult.normalizedCoordinateSpace === "browserViewport"
      ? input.geometrySnapshot.viewportHeight
      : input.geometrySnapshot.screenshotHeight;
    const geometryGuardProofBase = {
      proofId: input.guardResult.runtimeProof.proofId,
      geometryGuardRef: input.guardResult.geometryGuardRef,
      abilityGroupId: input.guardResult.runtimeProof.abilityGroupId,
      childCapabilityId: input.guardResult.runtimeProof.childCapabilityId,
      sourceAbilityGroupId: input.guardResult.runtimeProof.sourceAbilityGroupId,
      sourceChildCapabilityId: input.guardResult.runtimeProof.sourceChildCapabilityId,
      sessionId: input.guardResult.sessionId,
      roundId: input.guardResult.roundId,
      videoVisitId: input.guardResult.videoVisitId,
      status: input.guardResult.status,
      guardDecision: input.guardResult.guardDecision,
      normalizedClickPoint: input.guardResult.normalizedClickPoint,
      sourceScreenshotEvidenceRef: input.guardResult.sourceScreenshotEvidenceRef,
      sourceTargetRef: input.guardResult.sourceTargetRef,
      inputRef: input.guardResult.runtimeProof.inputRef,
      outputRef: input.guardResult.runtimeProof.outputRef,
    };

    const clickInput: MouseClickAbilityInput = childCapabilityId === "click-browser-coordinate"
      ? {
          abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
          childCapabilityId: "click-browser-coordinate" as const,
          sessionId: input.target.sourceScreenshotEvidenceId,
          roundId: null,
          videoVisitId: null,
          requestedBy: "orchestration",
          purpose: `${input.actionType}:${input.target.targetType}`,
          sourceCoordinateProofRef: input.guardResult.runtimeProof.proofId,
          sourceEvidenceRef: input.target.sourceScreenshotEvidenceId,
          sourceTargetRef: input.target.targetId,
          geometryGuardProof: {
            ...geometryGuardProofBase,
            normalizedCoordinateSpace: "browserViewport" as const,
          },
          bounds: {
            width: executionWidth,
            height: executionHeight,
          },
          button: "left" as const,
          clickCount: 1 as const,
          safetyPolicy: {
            allowOperatorManual: false,
            operatorManualApprovalRef: null,
            allowRightClick: false,
            allowDoubleClick: false,
            allowReplay: false,
            allowDesktopScreenClick: false,
            desktopScreenOperatorApprovalRef: null,
            maxDurationMs: 5000,
            primitiveTimeoutMs: 3000,
            cooldownMs: 800,
            requireStableRoundBinding: true,
            requireStableVideoVisitBinding: true,
          },
        }
      : {
          abilityGroupId: MOUSE_CLICK_ABILITY_GROUP_ID,
          childCapabilityId: "click-desktop-coordinate" as const,
          sessionId: input.target.sourceScreenshotEvidenceId,
          roundId: null,
          videoVisitId: null,
          requestedBy: "orchestration",
          purpose: `${input.actionType}:${input.target.targetType}`,
          sourceCoordinateProofRef: input.guardResult.runtimeProof.proofId,
          sourceEvidenceRef: input.target.sourceScreenshotEvidenceId,
          sourceTargetRef: input.target.targetId,
          geometryGuardProof: {
            ...geometryGuardProofBase,
            normalizedCoordinateSpace: "desktopScreen" as const,
          },
          bounds: {
            width: executionWidth,
            height: executionHeight,
          },
          button: "left" as const,
          clickCount: 1 as const,
          safetyPolicy: {
            allowOperatorManual: false,
            operatorManualApprovalRef: null,
            allowRightClick: false,
            allowDoubleClick: false,
            allowReplay: false,
            allowDesktopScreenClick: false,
            desktopScreenOperatorApprovalRef: null,
            maxDurationMs: 5000,
            primitiveTimeoutMs: 3000,
            cooldownMs: 800,
            requireStableRoundBinding: true,
            requireStableVideoVisitBinding: true,
          },
        };

    const clickResult = await this.mouseClickAbilityGroup.execute(clickInput);

    return {
      browserResult: {
        browserActionId: clickResult.actionExecutionRef,
        ok: clickResult.status === "success",
        message: clickResult.statusMessage,
        createdAt: clickResult.endedAt,
        fallbackUsed: false,
      },
      governedClickResult: clickResult,
    };
  }

  protected async buildVisualTarget(input: {
    targetType: VisualTargetType;
    boundingBox: VisualBoundingBox;
    clickPoint?: VisualClickPoint | null;
    confidence: number;
    sourceScreenshotEvidenceId: string;
    sourceCapturedAt?: string | null;
    detectionMethod: string;
    sourceAiResultRef?: string | null;
    sourceCandidateRef?: string | null;
    visibleText?: string | null;
    uncertainty?: string[];
    blockedReason?: string | null;
  }): Promise<VisualTarget> {
    const childCapabilityId = TARGET_TYPE_TO_CHILD_CAPABILITY_ID[input.targetType];
    if (!childCapabilityId) {
      throw new Error(`visual target child capability is not defined for ${input.targetType}`);
    }

    const geometry = await this.browserController.getGeometrySnapshot();
    const session = this.browserController.getSessionState();
    const capturedAt = input.sourceCapturedAt ?? geometry.capturedAt;
    const targetNature = TARGET_TYPE_TO_NATURE[input.targetType];
    const pageStateType = TARGET_TYPE_TO_PAGE_STATE_TYPE[input.targetType];
    const pageUrl = session.currentUrl || geometry.currentUrl || "about:blank";
    const pageTitle = session.currentTitle || geometry.pageTitle || null;
    const sourceProofRef = `visual-target-source:${input.sourceScreenshotEvidenceId}`;
    const pageStateProofRef = `visual-target-page-state:${input.sourceScreenshotEvidenceId}`;
    const inputRef = `visual-target-input:${childCapabilityId}:${input.sourceScreenshotEvidenceId}`;
    const candidateRef = input.sourceCandidateRef ?? `${input.targetType}-candidate`;

    const baseInput = {
      abilityGroupId: "visual-target" as const,
      childCapabilityId,
      sessionId: input.sourceScreenshotEvidenceId,
      roundId: null,
      videoVisitId: null,
      requestedBy: "orchestration",
      sourceAbilityGroupId: "orchestration",
      sourceChildCapabilityId: null,
      inputRef,
      targetType: input.targetType,
      targetNature,
      sourceProof: {
        sourceProofRef,
        screenshot: {
          screenshotEvidenceId: input.sourceScreenshotEvidenceId,
          artifactRef: `browser-capture:${input.sourceScreenshotEvidenceId}`,
          screenshotProofRef: `screenshot-proof:${input.sourceScreenshotEvidenceId}`,
          imageWidth: geometry.viewportWidth,
          imageHeight: geometry.viewportHeight,
          coordinateSpace: "browser_viewport" as const,
          capturedAt,
          sessionId: input.sourceScreenshotEvidenceId,
          roundId: null,
          videoVisitId: null,
        },
        ai: input.sourceAiResultRef
          ? {
              aiResultRef: input.sourceAiResultRef,
              aiProofRef: `visual-target-ai:${input.sourceAiResultRef}`,
              promptContractId: "visual-target-runtime-compat",
              outputSchemaRef: "visual-target-candidate",
              capturedAt,
              sessionId: input.sourceScreenshotEvidenceId,
              roundId: null,
              videoVisitId: null,
              confidence: input.confidence,
              modelRole: "runtime-compatibility",
            }
          : null,
        pageState: {
          pageStateProofRef,
          pageStateType,
          pageStateFingerprint: `${pageUrl}|${pageTitle ?? ""}|${pageStateType}`,
          decision: "allow" as const,
          currentUrl: pageUrl,
          currentTitle: pageTitle,
          observedAt: capturedAt,
          sessionId: input.sourceScreenshotEvidenceId,
          roundId: null,
          videoVisitId: null,
        },
        operatorApproval: null,
      },
      candidates: [{
        candidateRef,
        candidateKind: input.sourceAiResultRef ? "ai_candidate" as const : "heuristic_profile" as const,
        targetType: input.targetType,
        boundingBox: input.boundingBox,
        clickPoint: input.clickPoint ?? null,
        confidence: input.confidence,
        coordinateSpace: "browser_viewport" as const,
        sourceProofRef,
        capturedAt,
        sourceFrameRef: null,
        scaleMapping: null,
        detectionMethod: input.detectionMethod,
        visibleText: input.visibleText ?? null,
        uncertainty: input.uncertainty ?? [],
        blockedReason: input.blockedReason ?? null,
        isVisible: true,
        dataQualityFlags: [],
      }],
    };

    return this.visualTargetAbilityGroup.execute(baseInput);
  }

  protected buildVisualActionResult(input: {
    result: VisualActionResult["result"];
    afterEvidenceId?: string | null;
    verificationResult?: VisualActionVerificationResult | null;
    failureReason?: string | null;
    createdAt?: string;
  }): VisualActionResult {
    return VisualActionResultSchema.parse({
      actionLogId: createId("visual_action"),
      result: input.result,
      afterEvidenceId: input.afterEvidenceId ?? null,
      verificationResult: input.verificationResult ?? null,
      failureReason: input.failureReason ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }
}
