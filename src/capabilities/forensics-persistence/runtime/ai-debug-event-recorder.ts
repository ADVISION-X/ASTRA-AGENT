import type { ForensicsPersistenceAbilityGroup } from "../index.js";
import type { AiRuntimeStructuredDebugEvent } from "../../ai/runtime-adapters/local-ai-runtime-debug-contract.js";
import type { AiRuntimeStructuredDebugEventInput } from "./ai-debug-event-contract.js";
import { buildAiDebugArtifactRefs, buildAiDebugDataQualityFlags, buildAiStructuredRuntimeEvent } from "./ai-debug-event-payload.js";

type AiDebugRecorderRuntime = {
  browserSessionConfig: {
    profileRef: string | null;
  };
  browserController: {
    getSessionState(): {
      loginState: string | null;
    };
  };
  forensicsPersistenceAbilityGroup: {
    writeStructuredRuntimeEvent(input: unknown): Promise<unknown>;
  };
};

export const recordAiDebugEvent = async (
  runtime: AiDebugRecorderRuntime,
  input: AiRuntimeStructuredDebugEventInput | AiRuntimeStructuredDebugEvent,
): Promise<void> => {
  const normalizedInput: AiRuntimeStructuredDebugEventInput = {
    ...input,
    eventType: input.eventType === "AI_ERROR_DEBUG" ? "AI_FAILURE_DEBUG" : input.eventType,
  };
  const artifactRefs = buildAiDebugArtifactRefs(normalizedInput);
  const dataQualityFlags = buildAiDebugDataQualityFlags(normalizedInput);
  const structuredRuntimeEvent = buildAiStructuredRuntimeEvent({
    event: normalizedInput,
    browserProfileRef: runtime.browserSessionConfig.profileRef,
    loginState: runtime.browserController.getSessionState().loginState,
    artifactRefs,
    dataQualityFlags,
  });

  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "ai",
    sourceAbilityGroupId: "ai",
    sourceChildCapabilityId: structuredRuntimeEvent.childCapabilityId ?? "local-vision-ai",
    sessionId: normalizedInput.sessionId,
    roundId: normalizedInput.roundId ?? normalizedInput.attemptId,
    videoVisitId: normalizedInput.videoVisitId,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags,
    payload: { structuredRuntimeEvent },
  });
};