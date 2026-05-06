import {
  buildAiDebugArtifactRefs,
  buildAiStructuredRuntimeEvent,
  resolveAiDebugStep,
  splitTraceId,
  type WorkbenchAiDebugEvent,
  type WorkbenchAiDebugRuntime,
} from "./workbench-ai-debug-support.js";
import { getActiveMapChain } from "./workbench-map-chain-support.js";

type WorkbenchAiDebugForensicsRuntime = WorkbenchAiDebugRuntime & {
  forensicsPersistenceAbilityGroup: {
    writeStructuredRuntimeEvent(input: unknown): Promise<unknown>;
  };
  structuredLogBus?: {
    emitRuntimeEvent(entry: ReturnType<typeof buildAiStructuredRuntimeEvent>): void;
  };
};

const isCriticalAiRuntimeProof = (eventType: WorkbenchAiDebugEvent["eventType"]): boolean => (
  eventType === "AI_REQUEST_DEBUG" || eventType === "AI_INPUT_DEBUG_REJECTED" || eventType === "AI_RESPONSE_DEBUG" || eventType === "AI_ERROR_DEBUG"
);

export const recordWorkbenchAiDebugEvent = async (
  runtime: WorkbenchAiDebugForensicsRuntime,
  input: WorkbenchAiDebugEvent,
): Promise<void> => {
  const trace = splitTraceId(input.traceId);
  const mapChain = getActiveMapChain(trace.mapId);
  const artifactRefs = buildAiDebugArtifactRefs(input);
  const structuredRuntimeEvent = buildAiStructuredRuntimeEvent(runtime, input, artifactRefs);
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "ai",
    sourceAbilityGroupId: "ai",
    sourceChildCapabilityId: structuredRuntimeEvent.childCapabilityId ?? "local-vision-ai",
    missionId: input.missionId ?? trace.missionId ?? input.sessionId,
    runId: input.traceId ?? input.attemptId,
    sessionId: input.sessionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    stepId: input.stepId ?? input.roundId ?? resolveAiDebugStep(input.taskType),
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: trace.mapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.spanId ?? input.attemptId,
    inputRefs: input.refs,
    outputRefs: input.rawResponseRef ? [input.rawResponseRef] : [],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs,
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptVersion,
    persistencePolicy: {
      mode: "append",
      allowPartialRefs: !isCriticalAiRuntimeProof(input.eventType),
      allowExternalArtifactRef: isCriticalAiRuntimeProof(input.eventType),
    },
    dataQualityFlags: input.parserErrors,
    payload: { structuredRuntimeEvent },
  });
};
