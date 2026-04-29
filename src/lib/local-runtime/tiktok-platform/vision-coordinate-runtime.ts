import type { BrowserController, BrowserGeometrySnapshot } from "../../browser/browser-controller.js";
import type { GeometryGuardAbilityResult } from "../../../capabilities/geometry-guard/contract.js";
import { MOUSE_CLICK_ABILITY_GROUP_ID, type MouseClickAbilityGroup, type MouseClickAbilityInput } from "../../../capabilities/mouse-click/contract.js";
import type { ScreenshotAbilityGroup } from "../../../capabilities/screenshot/contract.js";
import type {
  SuccessfulVisualTarget,
  VisualBoundingBox,
  VisualTargetChildCapabilityId,
  VisualClickPoint,
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
      region: null,
      contentLines: input.contentLines ?? [],
    });
    if (result.status !== "success" || !result.browserCapture) {
      throw new Error(result.failureReason ?? `screenshot capture failed for ${input.regionLabel}`);
    }
    return result.browserCapture;
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
      browserActionId: clickResult.actionExecutionRef,
      ok: clickResult.status === "success",
      message: clickResult.statusMessage,
      createdAt: clickResult.endedAt,
      fallbackUsed: false,
    };
  }

  protected async buildVisualTarget(input: {
    targetType: VisualTargetType;
    boundingBox: VisualBoundingBox;
    clickPoint?: VisualClickPoint | null;
    confidence: number;
    sourceScreenshotEvidenceId: string;
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

    const baseInput = {
      childCapabilityId,
      sessionId: input.sourceScreenshotEvidenceId,
      roundId: null,
      videoVisitId: null,
      targetType: input.targetType,
      sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
      coordinateSpace: "browser_viewport" as const,
      sourceAiResultRef: input.sourceAiResultRef ?? null,
      candidates: [{
        sourceCandidateRef: input.sourceCandidateRef ?? `${input.targetType}-candidate`,
        sourceAiResultRef: input.sourceAiResultRef ?? null,
        sourceKind: "heuristic_profile" as const,
        targetType: input.targetType,
        boundingBox: input.boundingBox,
        clickPoint: input.clickPoint ?? null,
        confidence: input.confidence,
        coordinateSpace: "browser_viewport" as const,
        scaleMapping: null,
        detectionMethod: input.detectionMethod,
        visibleText: input.visibleText ?? null,
        uncertainty: input.uncertainty ?? [],
        blockedReason: input.blockedReason ?? null,
        isVisible: true,
        expectedRegionDistance: null,
      }],
      requestedBy: "orchestration",
      confidencePolicy: null,
      selectionPolicy: null,
      dataQualityPolicy: null,
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