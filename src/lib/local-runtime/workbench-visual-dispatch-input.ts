import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import {
  resolvePayloadRef,
  toDispatchPayload,
} from "./workbench-action-dispatch-shared.js";

const NEXT_VIDEO_ARROW_WIDTH = 72;
const NEXT_VIDEO_ARROW_HEIGHT = 108;
const NEXT_VIDEO_ARROW_RIGHT_INSET = 28;
const NEXT_VIDEO_ARROW_LOWER_CLICK_RATIO = 0.72;

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

const buildDeterministicNextVideoArrowCommand = async (
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
  const sourceTargetRef = `${envelope.inputRef}:next-video-arrow-target`;

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
    sourceGeometryHandoffRef: null,
    sourceCoordinateSpace: "browserViewport",
    requestedExecutionSpace: "browserViewport",
    bbox: executableGeometry.bbox,
    clickPoint: executableGeometry.clickPoint,
    viewportSize: {
      width: geometry.viewportWidth,
      height: geometry.viewportHeight,
    },
    deviceScaleFactor: geometry.scaleFactor,
    dataQualityFlags: ["deterministic_next_video_arrow_geometry"],
    idempotencyKey: envelope.idempotencyKey,
  }));
};

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
    return buildDeterministicNextVideoArrowCommand(runtime, envelope, inputPayload);
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