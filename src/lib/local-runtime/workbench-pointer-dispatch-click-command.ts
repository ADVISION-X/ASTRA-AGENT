import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import { resolveGeometryGuardClickHandoff } from "./workbench-muscle-joint-contract-resolvers.js";
import {
  toDispatchPayload,
} from "./workbench-action-dispatch-shared.js";

type GeometrySnapshot = Awaited<ReturnType<WorkbenchRuntime["browserController"]["getGeometrySnapshot"]>>;
type MouseClickGeometryGuardProof = ReturnType<typeof buildGeometryGuardProof>;
type GeometryGuardClickHandoff = NonNullable<ReturnType<typeof resolveGeometryGuardClickHandoff>>;

type MouseClickCommandContext = {
  geometry: GeometrySnapshot;
  geometryGuardProof: MouseClickGeometryGuardProof;
  sourceEvidenceRef: string | null;
  sourceRef: string;
};

const buildMouseClickPurpose = (envelope: AbilityCommandEnvelope, inputPayload: NerveBusPayloadDocument) => {
  return envelope.stepId === "click-next-video-arrow" ? "click_next_video" : inputPayload.summary;
};

const resolveMouseClickSourceChildCapabilityId = (
  envelope: AbilityCommandEnvelope,
  handoff: GeometryGuardClickHandoff,
) => {
  if (handoff.sourceChildCapabilityId) {
    return handoff.sourceChildCapabilityId;
  }

  return envelope.stepId === "click-next-video-arrow"
    ? "observe-next-item-target-candidate"
    : "observe-comments-button";
};

const buildGeometryGuardProof = (
  envelope: AbilityCommandEnvelope,
  handoff: GeometryGuardClickHandoff,
) => {
  return {
    childCapabilityId: handoff.childCapabilityId,
    geometryGuardRef: handoff.geometryGuardRef,
    inputRef: handoff.geometryGuardInputRef,
    proofId: handoff.geometryGuardProofRef,
    runtimeProofRef: handoff.geometryGuardRuntimeProofRef,
    outputRef: handoff.geometryGuardOutputRef,
    sourceAbilityGroupId: handoff.sourceAbilityGroupId,
    sourceChildCapabilityId: resolveMouseClickSourceChildCapabilityId(envelope, handoff),
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
    normalizedCoordinateSpace: handoff.normalizedCoordinateSpace,
    normalizedClickPoint: handoff.normalizedClickPoint,
    sourceBounds: { width: handoff.normalizedBbox.width, height: handoff.normalizedBbox.height },
    sourceScreenshotEvidenceRef: handoff.sourceScreenshotEvidenceRef,
    sourceTargetRef: handoff.sourceTargetRef,
    sourceAiResultRef: handoff.sourceAiResultRef,
    sourceVisualTargetResultRef: handoff.sourceVisualTargetResultRef,
    riskLevel: null,
    requiresPostClickAiVerification: false,
    dataQualityFlags: null,
  };
};

const resolveMouseClickCommandContext = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<MouseClickCommandContext> => {
  const payload = toDispatchPayload(inputPayload);
  const geometryGuardResultRef = payloadValueToString(payload.geometryGuardResultRef);
  if (!geometryGuardResultRef) {
    throw new Error(`Mouse Click dispatch for ${envelope.stepId} requires geometryGuardResultRef from GeometryGuardResult.`);
  }

  const geometryHandoff = resolveGeometryGuardClickHandoff(geometryGuardResultRef);
  if (!geometryHandoff) {
    throw new Error(`Mouse Click dispatch for ${envelope.stepId} requires a canonical GeometryGuardResult handoff.`);
  }

  const geometryGuardProof = buildGeometryGuardProof(envelope, geometryHandoff);
  return {
    geometry: await runtime.browserController.getGeometrySnapshot(),
    geometryGuardProof,
    sourceEvidenceRef: geometryGuardProof.sourceScreenshotEvidenceRef
      ?? payloadValueToString(payload.screenshotEvidenceRef)
      ?? payloadValueToString(payload.sourceEvidenceRef),
    sourceRef: geometryHandoff.sourceRef ?? geometryGuardProof.sourceTargetRef,
  };
};

const buildMouseClickGeometryGuardPayload = (geometryGuardProof: MouseClickGeometryGuardProof) => ({
  proofId: geometryGuardProof.proofId,
  geometryGuardRef: geometryGuardProof.geometryGuardRef,
  abilityGroupId: "geometry-guard",
  childCapabilityId: geometryGuardProof.childCapabilityId,
  sourceAbilityGroupId: geometryGuardProof.sourceAbilityGroupId,
  sourceChildCapabilityId: geometryGuardProof.sourceChildCapabilityId,
  missionId: geometryGuardProof.missionId,
  runId: geometryGuardProof.runId,
  sessionId: geometryGuardProof.sessionId,
  roundId: geometryGuardProof.roundId,
  videoVisitId: geometryGuardProof.videoVisitId,
  stepId: geometryGuardProof.stepId,
  mapPackageId: geometryGuardProof.mapPackageId,
  mapPackageVersion: geometryGuardProof.mapPackageVersion,
  selectedMapId: geometryGuardProof.selectedMapId,
  selectedMapVersion: geometryGuardProof.selectedMapVersion,
  activationSnapshotRef: geometryGuardProof.activationSnapshotRef,
  capabilityCallId: geometryGuardProof.capabilityCallId,
  nerveBusEnvelopeId: geometryGuardProof.nerveBusEnvelopeId,
  status: "success",
  guardDecision: "allow",
  normalizedCoordinateSpace: geometryGuardProof.normalizedCoordinateSpace,
  normalizedClickPoint: geometryGuardProof.normalizedClickPoint,
  sourceBounds: geometryGuardProof.sourceBounds,
  sourceScreenshotEvidenceRef: geometryGuardProof.sourceScreenshotEvidenceRef,
  sourceTargetRef: geometryGuardProof.sourceTargetRef,
  sourceVisualTargetResultRef: geometryGuardProof.sourceVisualTargetResultRef,
  riskLevel: geometryGuardProof.riskLevel,
  requiresPostClickAiVerification: geometryGuardProof.requiresPostClickAiVerification,
  dataQualityFlags: geometryGuardProof.dataQualityFlags,
  inputRef: geometryGuardProof.inputRef,
  outputRef: geometryGuardProof.outputRef,
  runtimeProofRef: geometryGuardProof.runtimeProofRef,
});

const buildMouseClickMetadata = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  context: MouseClickCommandContext,
) => ({
  abilityGroupId: "mouse-click",
  childCapabilityId: context.geometryGuardProof.normalizedCoordinateSpace === "desktopScreen"
    ? "click-desktop-coordinate"
    : "click-browser-coordinate",
  sourceAbilityGroupId: context.geometryGuardProof.sourceAbilityGroupId,
  sourceChildCapabilityId: context.geometryGuardProof.sourceChildCapabilityId,
  missionId: context.geometryGuardProof.missionId,
  runId: context.geometryGuardProof.runId,
  sessionId: context.geometryGuardProof.sessionId,
  roundId: context.geometryGuardProof.roundId,
  videoVisitId: context.geometryGuardProof.videoVisitId,
  stepId: context.geometryGuardProof.stepId,
  mapPackageId: context.geometryGuardProof.mapPackageId,
  mapPackageVersion: context.geometryGuardProof.mapPackageVersion,
  selectedMapId: context.geometryGuardProof.selectedMapId,
  selectedMapVersion: context.geometryGuardProof.selectedMapVersion,
  activationSnapshotRef: context.geometryGuardProof.activationSnapshotRef,
  capabilityCallId: context.geometryGuardProof.capabilityCallId,
  nerveBusEnvelopeId: context.geometryGuardProof.nerveBusEnvelopeId,
  requestedBy: "orchestration",
  purpose: buildMouseClickPurpose(envelope, inputPayload),
  inputRef: envelope.inputRef,
  sourceRef: context.sourceRef,
  sourceCoordinateProofRef: context.geometryGuardProof.proofId,
  sourceEvidenceRef: context.sourceEvidenceRef,
  sourceTargetRef: context.geometryGuardProof.sourceTargetRef,
  sourceVisualTargetResultRef: context.geometryGuardProof.sourceVisualTargetResultRef,
});

const buildMouseClickExecutionFields = (context: MouseClickCommandContext) => ({
  geometryGuardProof: buildMouseClickGeometryGuardPayload(context.geometryGuardProof),
  geometryGuardRef: context.geometryGuardProof.geometryGuardRef,
  guardDecision: "allow",
  geometryGuardOutputRef: context.geometryGuardProof.outputRef,
  geometryGuardRuntimeProofRef: context.geometryGuardProof.runtimeProofRef,
  geometryGuardNormalizedCoordinateSpace: context.geometryGuardProof.normalizedCoordinateSpace,
  geometryGuardNormalizedClickPoint: context.geometryGuardProof.normalizedClickPoint,
  button: "left",
  clickCount: 1,
  bounds: {
    width: context.geometry.viewportWidth,
    height: context.geometry.viewportHeight,
  },
});

const buildMouseClickCommandPayload = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  context: MouseClickCommandContext,
) => ({
  ...buildMouseClickMetadata(envelope, inputPayload, context),
  ...buildMouseClickExecutionFields(context),
  idempotencyKey: envelope.idempotencyKey,
  timeoutMs: 15000,
});

export const buildMouseClickCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const context = await resolveMouseClickCommandContext(runtime, envelope, inputPayload);
  return JSON.parse(JSON.stringify(buildMouseClickCommandPayload(envelope, inputPayload, context)));
};