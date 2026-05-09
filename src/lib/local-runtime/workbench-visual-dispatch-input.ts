import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import { resolveVisualTargetGeometryHandoff } from "./workbench-muscle-joint-contract-resolvers.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
} from "./workbench-action-dispatch-shared.js";
import { buildCommentsEntryVisualTargetCommand } from "./workbench-visual-dispatch-input-comments-target.js";
import { buildAdvanceNextItemGeometryGuardCommand } from "./workbench-visual-dispatch-input-next-item.js";
import { buildNextItemTargetVisualTargetCommand } from "./workbench-visual-dispatch-input-next-item-target.js";

const buildStructuredVisualTargetGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const visualTargetRef = payloadValueToString(payload.visualTargetResultRef)
    ?? payloadValueToString(payload.visualTargetRef)
    ?? payloadValueToString(payload.sourceVisualTargetResultRef)
    ?? payloadValueToString(payload.sourceTargetRef);
  const handoff = visualTargetRef ? resolveVisualTargetGeometryHandoff(visualTargetRef) : null;
  const sourceVisualTargetResultRef = handoff?.sourceVisualTargetResultRef ?? visualTargetRef;

  if (!handoff || !sourceVisualTargetResultRef) {
    throw new Error(`Geometry Guard dispatch for ${envelope.stepId} requires structured Visual Target geometry proof; center-screen fallback is forbidden.`);
  }

  const sourceTargetRef = handoff.sourceTargetRef;
  const sourceScreenshotEvidenceRef = handoff.sourceScreenshotEvidenceRef
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
    sourceChildCapabilityId: "observe-comments-button",
    inputRef: envelope.inputRef,
    sourceRef: sourceTargetRef,
    sourceScreenshotEvidenceRef,
    sourceTargetRef,
    sourceAiResultRef: handoff.sourceAiResultRef,
    sourcePageStateProofRef: handoff.sourcePageStateProofRef,
    sourceVisualTargetResultRef,
    sourceGeometryHandoffRef: handoff.handoffRef,
    sourceCoordinateSpace: handoff.coordinateSpace,
    requestedExecutionSpace: "browserViewport",
    bbox: handoff.bbox,
    clickPoint: handoff.clickPoint,
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
