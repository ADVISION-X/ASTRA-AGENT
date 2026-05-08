import {
  buildAiDebugArtifactRefs,
  buildAiStructuredRuntimeEvent,
  resolveAiDebugStep,
  type WorkbenchAiDebugEvent,
  type WorkbenchAiDebugRuntime,
} from "./workbench-ai-debug-support.js";
import {
  buildAiDebugDurableRuntimeEvent,
  isAiDebugDurableEnabled,
  shouldDurablyPersistAiDebugEvent,
} from "./workbench-debug-persistence-policy.js";
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
  eventType === "AI_INPUT_REQUEST_DEBUG"
  || eventType === "AI_PROMPT_REQUEST_DEBUG"
  || eventType === "AI_REQUEST_DEBUG"
  || eventType === "AI_INPUT_DEBUG_REJECTED"
  || eventType === "AI_RAW_RESPONSE_DEBUG"
  || eventType === "AI_NORMALIZED_RESPONSE_DEBUG"
  || eventType === "AI_RESPONSE_DEBUG"
  || eventType === "AI_ERROR_DEBUG"
);

const resolveCanonicalAiChain = (input: WorkbenchAiDebugEvent) => {
  const selectedMapId = input.selectedMapId ?? null;
  const mapChain = getActiveMapChain(selectedMapId);
  return {
    missionId: input.missionId ?? input.sessionId,
    runId: input.runId ?? input.missionId ?? input.sessionId,
    stepId: input.stepId ?? input.roundId ?? resolveAiDebugStep(input.taskType),
    mapPackageId: input.mapPackageId ?? mapChain.mapPackageId,
    mapPackageVersion: input.mapPackageVersion ?? mapChain.mapPackageVersion,
    selectedMapId,
    selectedMapVersion: input.selectedMapVersion ?? mapChain.selectedMapVersion,
    activationSnapshotRef: input.activationSnapshotRef ?? mapChain.activationSnapshotRef,
    capabilityCallId: input.capabilityCallId ?? null,
    nerveBusEnvelopeId: input.nerveBusEnvelopeId ?? null,
    inputRef: input.inputRef ?? input.refs[0] ?? null,
    idempotencyKey: input.idempotencyKey ?? input.runtimeCallId ?? input.spanId ?? input.attemptId,
  };
};

export const recordWorkbenchAiDebugEvent = async (
  runtime: WorkbenchAiDebugForensicsRuntime,
  input: WorkbenchAiDebugEvent,
): Promise<void> => {
  const chain = resolveCanonicalAiChain(input);
  const artifactRefs = buildAiDebugArtifactRefs(input);
  const structuredRuntimeEvent = buildAiStructuredRuntimeEvent(runtime, input, artifactRefs);
  runtime.structuredLogBus?.emitRuntimeEvent(structuredRuntimeEvent);
  if (!shouldDurablyPersistAiDebugEvent(input.eventType)) {
    return;
  }

  const durableEvent = buildAiDebugDurableRuntimeEvent(structuredRuntimeEvent);
  const durableFullDebug = isAiDebugDurableEnabled();
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "ai",
    sourceAbilityGroupId: "ai",
    sourceChildCapabilityId: structuredRuntimeEvent.childCapabilityId ?? "local-vision-ai",
    missionId: chain.missionId,
    runId: chain.runId,
    sessionId: input.sessionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    stepId: chain.stepId,
    mapPackageId: chain.mapPackageId,
    mapPackageVersion: chain.mapPackageVersion,
    selectedMapId: chain.selectedMapId,
    selectedMapVersion: chain.selectedMapVersion,
    activationSnapshotRef: chain.activationSnapshotRef,
    capabilityCallId: chain.capabilityCallId,
    inputRefs: durableFullDebug ? [...new Set([...(chain.inputRef ? [chain.inputRef] : []), ...input.refs])] : [],
    outputRefs: durableFullDebug && input.rawResponseRef ? [input.rawResponseRef] : [],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: durableFullDebug ? artifactRefs : [],
    promptContractId: input.promptContractId,
    promptContractVersion: input.promptVersion,
    persistencePolicy: {
      mode: "append",
      allowPartialRefs: durableFullDebug ? !isCriticalAiRuntimeProof(input.eventType) : true,
      allowExternalArtifactRef: durableFullDebug && isCriticalAiRuntimeProof(input.eventType),
    },
    dataQualityFlags: durableFullDebug ? input.parserErrors : [],
    payload: { structuredRuntimeEvent: durableEvent },
  });
};
