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

type StructuredGeometryGuardContext = {
  geometry: Awaited<ReturnType<WorkbenchRuntime["browserController"]["getGeometrySnapshot"]>>;
  handoff: NonNullable<ReturnType<typeof resolveVisualTargetGeometryHandoff>>;
  sourceScreenshotEvidenceRef: string;
  sourceTargetRef: string;
  sourceVisualTargetResultRef: string;
};

const resolveStructuredGeometryGuardContext = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<StructuredGeometryGuardContext> => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  const visualTargetResultRef = payloadValueToString(payload.visualTargetResultRef)
    ?? payloadValueToString(payload.sourceVisualTargetResultRef);
  const handoff = visualTargetResultRef ? resolveVisualTargetGeometryHandoff(visualTargetResultRef) : null;
  const sourceVisualTargetResultRef = handoff?.sourceVisualTargetResultRef ?? visualTargetResultRef;

  if (!handoff || !sourceVisualTargetResultRef) {
    throw new Error(`Geometry Guard dispatch for ${envelope.stepId} requires structured Visual Target geometry proof; center-screen fallback is forbidden.`);
  }

  return {
    geometry,
    handoff,
    sourceScreenshotEvidenceRef: handoff.sourceScreenshotEvidenceRef
      ?? resolvePayloadRef(payload, ["screenshotEvidenceRef", "sourceEvidenceRef"], `${envelope.inputRef}:screenshot`),
    sourceTargetRef: handoff.sourceTargetRef,
    sourceVisualTargetResultRef,
  };
};

const buildStructuredGeometryGuardPayload = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  context: StructuredGeometryGuardContext,
) => ({
  ...buildStructuredGeometryIdentityPayload(envelope, inputPayload),
  ...buildStructuredGeometrySourcePayload(envelope, context),
  viewportSize: {
    width: context.geometry.viewportWidth,
    height: context.geometry.viewportHeight,
  },
  deviceScaleFactor: context.geometry.scaleFactor,
  targetSemanticOwner: "visual-target",
  dataQualityFlags: ["governed_visual_target_geometry"],
  idempotencyKey: envelope.idempotencyKey,
});

const buildStructuredGeometryIdentityPayload = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => ({
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
});

const buildStructuredGeometrySourcePayload = (
  envelope: AbilityCommandEnvelope,
  context: StructuredGeometryGuardContext,
) => ({
  sourceRef: context.sourceTargetRef,
  sourceScreenshotEvidenceRef: context.sourceScreenshotEvidenceRef,
  sourceTargetRef: context.sourceTargetRef,
  sourceAiResultRef: context.handoff.sourceAiResultRef,
  sourcePageStateProofRef: context.handoff.sourcePageStateProofRef,
  sourceVisualTargetResultRef: context.sourceVisualTargetResultRef,
  sourceGeometryHandoffRef: context.handoff.handoffRef,
  sourceCoordinateSpace: context.handoff.coordinateSpace,
  requestedExecutionSpace: "browserViewport",
  bbox: context.handoff.bbox,
  clickPoint: context.handoff.clickPoint,
});

const buildStructuredVisualTargetGeometryGuardCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const context = await resolveStructuredGeometryGuardContext(runtime, envelope, inputPayload);
  return JSON.parse(JSON.stringify(buildStructuredGeometryGuardPayload(envelope, inputPayload, context)));
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
  const aiTargetCandidateRef = payloadValueToString(payload.aiResultRef)
    ?? payloadValueToString(payload.sourceAiResultRef)
    ?? payloadValueToString(payload.aiTargetCandidateRef)
    ?? payloadValueToString(payload.targetCandidateRef);

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
