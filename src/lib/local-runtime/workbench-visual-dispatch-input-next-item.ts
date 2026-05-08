import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
  type DispatchPayloadRecord,
} from "./workbench-action-dispatch-shared.js";

const NEXT_VIDEO_ARROW_WIDTH = 72;
const NEXT_VIDEO_ARROW_HEIGHT = 108;
const NEXT_VIDEO_ARROW_RIGHT_INSET = 28;
const NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO = 0.72;
const NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV = "GRASSEYE_ALLOW_NEXT_VIDEO_DETERMINISTIC_FALLBACK";

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(Math.max(value, minimum), maximum);
};

const buildNextVideoArrowGeometry = (input: {
  viewportWidth: number;
  viewportHeight: number;
}) => {
  const bboxWidth = clamp(NEXT_VIDEO_ARROW_WIDTH, 48, input.viewportWidth);
  const bboxHeight = clamp(NEXT_VIDEO_ARROW_HEIGHT, 64, input.viewportHeight);
  const bboxX = clamp(
    input.viewportWidth - NEXT_VIDEO_ARROW_RIGHT_INSET - bboxWidth,
    0,
    Math.max(input.viewportWidth - bboxWidth, 0),
  );
  const bboxY = clamp(
    Math.round(input.viewportHeight / 2) - Math.round(bboxHeight / 2),
    0,
    Math.max(input.viewportHeight - bboxHeight, 0),
  );

  return {
    bbox: {
      x: bboxX,
      y: bboxY,
      width: bboxWidth,
      height: bboxHeight,
    },
    clickPoint: {
      x: bboxX + Math.round(bboxWidth / 2),
      y: clamp(
        bboxY + Math.round(bboxHeight * NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO),
        bboxY + 1,
        bboxY + bboxHeight - 1,
      ),
    },
  };
};

const isAdvanceNextItemDeterministicFallbackEnabled = (): boolean =>
  process.env[NEXT_VIDEO_DETERMINISTIC_FALLBACK_POLICY_ENV] === "1";

const buildDeterministicNextVideoArrowFallbackCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const executableGeometry = buildNextVideoArrowGeometry({
    viewportWidth: geometry.viewportWidth,
    viewportHeight: geometry.viewportHeight,
  });
  const sourceScreenshotEvidenceRef = resolvePayloadRef(
    payload,
    ["screenshotEvidenceRef", "sourceEvidenceRef"],
    `${envelope.inputRef}:next-video-arrow-screenshot`,
  );
  const sourceTargetRef = `${envelope.inputRef}:deterministic-fallback-geometry-candidate`;

  return JSON.parse(JSON.stringify({
    abilityGroupId: "geometry-guard",
    childCapabilityId: "validate-browser-viewport-bounds",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: "click_next_video",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.stepId,
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: null,
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef: null,
    sourceGeometryHandoffRef: `${envelope.inputRef}:deterministic-fallback-handoff`,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: executableGeometry.bbox,
    clickPoint: executableGeometry.clickPoint,
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    riskLevel: "high",
    requiresPostClickAiVerification: true,
    fallbackReason: "missing_governed_next_item_target_candidate",
    targetSemanticOwner: "missing",
    actionableMessage: "Deterministic fallback geometry may click a previous or incorrect affordance; post-click AI verification is mandatory before treating the item as advanced.",
    dataQualityFlags: [
      "deterministic_next_video_arrow_geometry_fallback",
      "mechanical_click_success_is_not_next_item_semantic_success",
      "requires_post_click_ai_verification",
    ],
    idempotencyKey: envelope.idempotencyKey,
  }));
};

const resolveNextItemTargetCandidateRef = (payload: DispatchPayloadRecord): string | null =>
  payloadValueToString(payload.nextItemTargetCandidateRef)
  ?? payloadValueToString(payload.aiTargetCandidateRef)
  ?? payloadValueToString(payload.targetCandidateRef)
  ?? payloadValueToString(payload.sourceVisualTargetResultRef);

const readSummaryNumber = (summary: Record<string, unknown> | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readSummaryString = (summary: Record<string, unknown> | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildStructuredNextItemGeometryCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  targetCandidateRef: string,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const summary = resolveAbilityResultProofSummary(targetCandidateRef);
  const bboxX = readSummaryNumber(summary, "sourceBoundsX");
  const bboxY = readSummaryNumber(summary, "sourceBoundsY");
  const bboxWidth = readSummaryNumber(summary, "sourceBoundsWidth");
  const bboxHeight = readSummaryNumber(summary, "sourceBoundsHeight");
  const clickX = readSummaryNumber(summary, "normalizedClickPointX");
  const clickY = readSummaryNumber(summary, "normalizedClickPointY");
  const sourceVisualTargetResultRef = payloadValueToString(payload.sourceVisualTargetResultRef)
    ?? payloadValueToString(payload.visualTargetRef)
    ?? readSummaryString(summary, "sourceVisualTargetResultRef");

  if (!sourceVisualTargetResultRef || bboxX === null || bboxY === null || bboxWidth === null || bboxHeight === null || clickX === null || clickY === null) {
    throw new Error("normalize-next-video-arrow received a target candidate ref but lacks structured Visual Target geometry proof; deterministic geometry is fallback-only and cannot replace candidate validation.");
  }

  const sourceTargetRef = readSummaryString(summary, "sourceTargetRef") ?? targetCandidateRef;
  const sourceScreenshotEvidenceRef = readSummaryString(summary, "sourceScreenshotEvidenceRef")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:next-video-arrow-screenshot`);

  return JSON.parse(JSON.stringify({
    abilityGroupId: "geometry-guard",
    childCapabilityId: "validate-browser-viewport-bounds",
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    requestedBy: "orchestration",
    purpose: "click_next_video",
    sourceAbilityGroupId: "visual-target",
    sourceChildCapabilityId: "observe-next-item-target-candidate",
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: payloadValueToString(payload.sourceAiResultRef) ?? readSummaryString(summary, "sourceAiResultRef"),
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef,
    sourceGeometryHandoffRef: readSummaryString(summary, "sourceGeometryHandoffRef"),
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: { x: bboxX, y: bboxY, width: bboxWidth, height: bboxHeight },
    clickPoint: { x: clickX, y: clickY },
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    targetSemanticOwner: "visual-target",
    dataQualityFlags: ["governed_next_item_target_candidate_geometry"],
    idempotencyKey: envelope.idempotencyKey,
  }));
};

export const buildAdvanceNextItemGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const targetCandidateRef = resolveNextItemTargetCandidateRef(payload);

  if (targetCandidateRef) {
    return buildStructuredNextItemGeometryCommand(runtime, envelope, inputPayload, targetCandidateRef);
  }
  if (!isAdvanceNextItemDeterministicFallbackEnabled()) {
    throw new Error("Advance Next Item target candidate is required; deterministic next-video geometry is fallback-only and disabled.");
  }
  return buildDeterministicNextVideoArrowFallbackCommand(runtime, envelope, inputPayload);
};
