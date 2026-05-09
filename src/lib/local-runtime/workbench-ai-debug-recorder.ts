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

const resolveAiDebugPersistenceRefs = (input: {
  chain: ReturnType<typeof resolveCanonicalAiChain>;
  debugEvent: WorkbenchAiDebugEvent;
  artifactRefs: ReturnType<typeof buildAiDebugArtifactRefs>;
  durableFullDebug: boolean;
}) => ({
  inputRefs: input.durableFullDebug ? [...new Set([...(input.chain.inputRef ? [input.chain.inputRef] : []), ...input.debugEvent.refs])] : [],
  outputRefs: input.durableFullDebug && input.debugEvent.rawResponseRef ? [input.debugEvent.rawResponseRef] : [],
  artifactRefs: input.durableFullDebug ? input.artifactRefs : [],
  dataQualityFlags: input.durableFullDebug ? input.debugEvent.parserErrors : [],
});

const resolveAiDebugPersistencePolicy = (input: {
  debugEvent: WorkbenchAiDebugEvent;
  durableFullDebug: boolean;
}) => ({
  mode: "append" as const,
  allowPartialRefs: input.durableFullDebug ? !isCriticalAiRuntimeProof(input.debugEvent.eventType) : true,
  allowExternalArtifactRef: input.durableFullDebug && isCriticalAiRuntimeProof(input.debugEvent.eventType),
});

const buildAiDebugStructuredRuntimeWriteInput = (input: {
  runtime: WorkbenchAiDebugForensicsRuntime;
  debugEvent: WorkbenchAiDebugEvent;
  chain: ReturnType<typeof resolveCanonicalAiChain>;
  artifactRefs: ReturnType<typeof buildAiDebugArtifactRefs>;
  structuredRuntimeEvent: ReturnType<typeof buildAiStructuredRuntimeEvent>;
  durableEvent: ReturnType<typeof buildAiDebugDurableRuntimeEvent>;
  durableFullDebug: boolean;
}) => ({
  abilityGroupId: "forensics-persistence",
  childCapabilityId: "write-structured-runtime-event",
  recordType: "structured_runtime_event",
  requestedBy: "ai",
  sourceAbilityGroupId: "ai",
  sourceChildCapabilityId: input.structuredRuntimeEvent.childCapabilityId ?? "local-vision-ai",
  missionId: input.chain.missionId,
  runId: input.chain.runId,
  sessionId: input.debugEvent.sessionId,
  roundId: input.debugEvent.roundId ?? input.debugEvent.attemptId,
  videoVisitId: input.debugEvent.videoVisitId,
  stepId: input.chain.stepId,
  mapPackageId: input.chain.mapPackageId,
  mapPackageVersion: input.chain.mapPackageVersion,
  selectedMapId: input.chain.selectedMapId,
  selectedMapVersion: input.chain.selectedMapVersion,
  activationSnapshotRef: input.chain.activationSnapshotRef,
  capabilityCallId: input.chain.capabilityCallId,
  sourceRecordRefs: [],
  parentRefs: [],
  promptContractId: input.debugEvent.promptContractId,
  promptContractVersion: input.debugEvent.promptVersion,
  ...resolveAiDebugPersistenceRefs(input),
  persistencePolicy: resolveAiDebugPersistencePolicy(input),
  payload: { structuredRuntimeEvent: input.durableEvent },
});

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
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent(
    buildAiDebugStructuredRuntimeWriteInput({
      runtime,
      debugEvent: input,
      chain,
      artifactRefs,
      structuredRuntimeEvent,
      durableEvent,
      durableFullDebug,
    }),
  );
};
