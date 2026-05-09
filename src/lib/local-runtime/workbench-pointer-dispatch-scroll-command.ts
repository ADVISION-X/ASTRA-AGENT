import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadValueToString } from "./workbench-payload.js";
import { toDispatchPayload } from "./workbench-action-dispatch-shared.js";

type GeometrySnapshot = Awaited<ReturnType<WorkbenchRuntime["browserController"]["getGeometrySnapshot"]>>;

type MouseScrollCommandContext = {
  executableAnchorPoint: { x: number; y: number };
  geometry: GeometrySnapshot;
  geometryProofRef: string;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string;
};

const resolveMouseScrollCommandContext = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
): Promise<MouseScrollCommandContext> => {
  const payload = toDispatchPayload(inputPayload);
  const geometry = await runtime.browserController.getGeometrySnapshot();
  return {
    geometry,
    geometryProofRef: payloadValueToString(payload.geometryProofRef) ?? envelope.inputRef,
    sourceTargetRef: payloadValueToString(payload.sourceTargetRef)
      ?? payloadValueToString(payload.visualTargetRef)
      ?? envelope.inputRef,
    sourceEvidenceRef: payloadValueToString(payload.sourceEvidenceRef)
      ?? payloadValueToString(payload.screenshotEvidenceRef),
    executableAnchorPoint: {
      x: Math.round(geometry.viewportWidth / 2),
      y: Math.round(geometry.viewportHeight / 2),
    },
  };
};

const buildMouseScrollGeometryProof = (
  envelope: AbilityCommandEnvelope,
  context: MouseScrollCommandContext,
) => ({
  proofId: context.geometryProofRef,
  geometryGuardRef: context.geometryProofRef,
  abilityGroupId: "geometry-guard",
  childCapabilityId: "validate-browser-viewport-bounds",
  sourceAbilityGroupId: "visual-target",
  sourceChildCapabilityId: "observe-next-video-region",
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
  status: "success",
  guardDecision: "allow",
  normalizedCoordinateSpace: "browserViewport",
  normalizedAnchorPoint: context.executableAnchorPoint,
  normalizedRegion: null,
  sourceScreenshotEvidenceRef: context.sourceEvidenceRef,
  sourceTargetRef: context.sourceTargetRef,
  inputRef: envelope.inputRef,
  outputRef: context.geometryProofRef,
});

const buildMouseScrollMetadata = (
  envelope: AbilityCommandEnvelope,
  context: MouseScrollCommandContext,
) => ({
  abilityGroupId: "mouse-scroll",
  childCapabilityId: "scroll-browser-viewport",
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
  purpose: "scroll_next_video",
  sourceAbilityGroupId: "orchestration",
  sourceChildCapabilityId: envelope.commandName,
  sourceCoordinateProofRef: context.geometryProofRef,
  sourceEvidenceRef: context.sourceEvidenceRef,
  sourceTargetRef: context.sourceTargetRef,
});

const buildMouseScrollExecutionFields = (context: MouseScrollCommandContext) => ({
  coordinateSpace: "browserViewport",
  bounds: {
    width: context.geometry.viewportWidth,
    height: context.geometry.viewportHeight,
  },
  direction: "down",
  magnitude: "onePage",
  repeat: 2,
  safetyPolicy: {
    primitiveTimeoutMs: 60000,
    maxDurationMs: 60000,
  },
});

const buildMouseScrollCommandPayload = (
  envelope: AbilityCommandEnvelope,
  context: MouseScrollCommandContext,
) => ({
  ...buildMouseScrollMetadata(envelope, context),
  geometryScrollProof: buildMouseScrollGeometryProof(envelope, context),
  ...buildMouseScrollExecutionFields(context),
});

export const buildMouseScrollCommand = async (
  runtime: WorkbenchRuntime,
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const context = await resolveMouseScrollCommandContext(runtime, envelope, inputPayload);
  return JSON.parse(JSON.stringify(buildMouseScrollCommandPayload(envelope, context)));
};