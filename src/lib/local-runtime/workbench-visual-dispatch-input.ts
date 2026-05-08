import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolveAbilityResultProofSummary } from "../../capabilities/orchestration/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
} from "./workbench-action-dispatch-shared.js";
import { buildCommentsEntryVisualTargetCommand } from "./workbench-visual-dispatch-input-comments-target.js";
import { buildAdvanceNextItemGeometryGuardCommand } from "./workbench-visual-dispatch-input-next-item.js";
import { buildNextItemTargetVisualTargetCommand } from "./workbench-visual-dispatch-input-next-item-target.js";

const readSummaryNumber = (summary: Record<string, unknown> | null, key: string): number | null => {
  const value = summary?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readSummaryString = (summary: Record<string, unknown> | null, key: string): string | null => {
  const value = summary?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

const buildStructuredVisualTargetGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const visualTargetRef = payloadValueToString(payload.visualTargetRef)
    ?? payloadValueToString(payload.sourceVisualTargetResultRef)
    ?? payloadValueToString(payload.sourceTargetRef);
  const summary = visualTargetRef ? resolveAbilityResultProofSummary(visualTargetRef) : null;
  const bboxX = readSummaryNumber(summary, "sourceBoundsX");
  const bboxY = readSummaryNumber(summary, "sourceBoundsY");
  const bboxWidth = readSummaryNumber(summary, "sourceBoundsWidth");
  const bboxHeight = readSummaryNumber(summary, "sourceBoundsHeight");
  const clickX = readSummaryNumber(summary, "normalizedClickPointX");
  const clickY = readSummaryNumber(summary, "normalizedClickPointY");
  const sourceVisualTargetResultRef = readSummaryString(summary, "sourceVisualTargetResultRef") ?? visualTargetRef;

  if (!sourceVisualTargetResultRef || bboxX === null || bboxY === null || bboxWidth === null || bboxHeight === null || clickX === null || clickY === null) {
    throw new Error(`Geometry Guard dispatch for ${envelope.stepId} requires structured Visual Target geometry proof; center-screen fallback is forbidden.`);
  }

  const sourceTargetRef = readSummaryString(summary, "sourceTargetRef") ?? sourceVisualTargetResultRef;
  const sourceScreenshotEvidenceRef = readSummaryString(summary, "sourceScreenshotEvidenceRef")
    ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshot`);

  return JSON.parse(JSON.stringify({
    abilityGroupId: "geometry-guard",
    childCapabilityId: envelope.commandName === "normalize-coordinate-geometry"
      ? "validate-browser-viewport-bounds"
      : "validate-coordinate-space",
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
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "visual-target",
    sourceChildCapabilityId: readSummaryString(summary, "childCapabilityId") ?? "observe-comments-button",
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: readSummaryString(summary, "sourceAiResultRef"),
    sourcePageStateProofRef: readSummaryString(summary, "sourcePageStateProofRef"),
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
    dataQualityFlags: ["governed_visual_target_geometry"],
    idempotencyKey: envelope.idempotencyKey,
  }));
};

export const buildVisualTargetCommand = (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  if (envelope.commandName === "observe-next-item-target-candidate") {
    return buildNextItemTargetVisualTargetCommand(runtime, envelope, inputPayload);
  }
  if (envelope.commandName === "observe-comments-button") {
    return buildCommentsEntryVisualTargetCommand(runtime, envelope, inputPayload);
  }

  const payload = toDispatchPayload(inputPayload);
  const isCommentsButton = envelope.commandName === "observe-comments-button";
  const targetType = isCommentsButton ? "comments_button" : "next_video_region";
  const aiTargetCandidateRef = payloadValueToString(payload.aiTargetCandidateRef)
    ?? payloadValueToString(payload.targetCandidateRef)
    ?? payloadValueToString(payload.sourceAiResultRef);

  if (!aiTargetCandidateRef) {
    throw new Error(`Visual Target dispatch for ${targetType} requires an AI target candidate ref. Heuristic target generation is forbidden.`);
  }

  throw new Error(`Visual Target AI candidate dispatch is not wired for ${targetType}; Route Plan must pass structured AI candidate geometry before this non-AI ability can run.`);
};

export const buildGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  if (envelope.stepId === "normalize-next-video-arrow") {
    return buildAdvanceNextItemGeometryGuardCommand(runtime, envelope, inputPayload);
  }
  return buildStructuredVisualTargetGeometryGuardCommand(runtime, envelope, inputPayload);
};
