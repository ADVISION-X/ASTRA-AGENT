import type { ForensicsPersistenceAbilityGroup } from "../index.js";
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
  forensicsPersistenceAbilityGroup: ForensicsPersistenceAbilityGroup;
};

export const recordAiDebugEvent = async (
  runtime: AiDebugRecorderRuntime,
  input: AiRuntimeStructuredDebugEventInput,
): Promise<void> => {
  const artifactRefs = buildAiDebugArtifactRefs(input);
  const dataQualityFlags = buildAiDebugDataQualityFlags(input);
  const structuredRuntimeEvent = buildAiStructuredRuntimeEvent({
    event: input,
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
    sourceChildCapabilityId: structuredRuntimeEvent.childCapabilityId,
    sessionId: input.sessionId,
    roundId: input.roundId ?? input.attemptId,
    videoVisitId: input.videoVisitId,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs,
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags,
    payload: { structuredRuntimeEvent },
  });
};