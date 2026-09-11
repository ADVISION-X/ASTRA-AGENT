import { executeAppendArtifact } from "./children/append-artifact/handler.js";
import { executeReadArtifactRef } from "./children/read-artifact-ref/handler.js";
import type { ForensicsPersistenceAbilityGroup } from "./contract.js";
import { createForensicsStorageAdapter } from "./storage-adapter.js";
import type { ForensicsAppendArtifactInput, ForensicsAppendArtifactResult } from "./schema.js";
import type { ForensicsStoragePort } from "./storage-port.js";
import type { GrassEyeStoragePort } from "../../lib/storage/index.js";
import { RuntimeFailureImpact, requireRuntimeLogWrite, runtimeFailureFromError,
  type RuntimeLogger } from "../../lib/runtime-logs/index.js";

const appendArtifactWithLog = async (input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort, runtimeLogger?: RuntimeLogger): Promise<ForensicsAppendArtifactResult> => {
  const span = runtimeLogger ? requireRuntimeLogWrite(runtimeLogger.startSpan({
    traceId: input.missionId,
    owner: "forensics-persistence",
    component: "forensics-persistence",
    operation: "forensics.append-artifact",
    typedIdentity: { kind: "request", requestId: input.capabilityCallId ?? `${input.missionId}:${input.runId}` },
    visibility: "DEBUG",
  })) : undefined;
  try {
    const result = await executeAppendArtifact(input, storage);
    if (span) requireRuntimeLogWrite(result.status === "success"
      ? span.terminal({ outcome: "succeeded" })
      : span.terminal({ outcome: "failed", failure: runtimeFailureFromError({
        error: new Error(result.failureReason), code: result.failureReason,
        responsibleOwner: "forensics-persistence", impact: RuntimeFailureImpact.BLOCKING,
      }) }));
    return result;
  } catch (error) {
    if (span) requireRuntimeLogWrite(span.terminal({ outcome: "failed", failure: runtimeFailureFromError({
      error, code: "FORENSICS_ARTIFACT_APPEND_FAILED",
      responsibleOwner: "forensics-persistence", impact: RuntimeFailureImpact.BLOCKING,
    }) }));
    throw error;
  }
};

export function createForensicsPersistenceAbilityGroup(storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger): ForensicsPersistenceAbilityGroup {
  return {
    appendArtifact: async (input) => {
      const { correlationId, ...artifact } = input;
      return appendArtifactWithLog({ ...artifact,
        ...(correlationId ? { capabilityCallId: correlationId } : {}) }, storage, runtimeLogger);
    },
    readArtifactRef: (input) => executeReadArtifactRef(input, storage),
  };
}

export function createForensicsPersistenceAbilityGroupFromStorage(storage: GrassEyeStoragePort,
  runtimeLogger?: RuntimeLogger): ForensicsPersistenceAbilityGroup {
  return createForensicsPersistenceAbilityGroup(createForensicsStorageAdapter(storage), runtimeLogger);
}
