import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
} from "./workbench-action-dispatch-shared.js";
import { buildAdvanceNextItemGeometryGuardCommand } from "./workbench-visual-dispatch-input-next-item.js";

export const buildVisualTargetCommand = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
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

  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const sourceTargetRef = resolvePayloadRef(
    payload,
    ["visualTargetRef", "sourceTargetRef", "abilityResultRef"],
    `${envelope.inputRef}:visual-target`,
  );
  const sourceScreenshotEvidenceRef = resolvePayloadRef(
    payload,
    ["screenshotEvidenceRef", "sourceScreenshotEvidenceId", "sourceEvidenceRef"],
    `${envelope.inputRef}:screenshot`,
  );

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
    sourceAiResultRef: null,
    sourcePageStateProofRef: null,
    sourceVisualTargetResultRef: sourceTargetRef,
    sourceGeometryHandoffRef: null,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: {
      x: 0,
      y: 0,
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    clickPoint: {
      x: Math.round(geometry.viewportWidth / 2),
      y: Math.round(geometry.viewportHeight / 2),
    },
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    idempotencyKey: envelope.idempotencyKey,
  }));
};
