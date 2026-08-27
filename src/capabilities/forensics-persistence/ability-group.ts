import { executeAppendArtifact } from "./children/append-artifact.js";
import { executeAppendRecord } from "./children/append-record.js";
import { executeReadRecordRef } from "./children/read-record-ref.js";
import type { ForensicsPersistenceAbilityGroup } from "./contract.js";
import { createForensicsStorageAdapter } from "./storage-adapter.js";
import type {
  ForensicsAbilityInput,
  ForensicsAppendArtifactInput,
  ForensicsAppendRecordInput,
  ForensicsReadRecordRefInput,
  ForensicsResult,
} from "./schema.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID } from "./schema.js";
import type { ForensicsStoragePort } from "./storage-port.js";
import type { GrassEyeStoragePort } from "../../lib/storage/index.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";

type AppendableForensicsInput =
  | ForensicsAppendArtifactInput
  | ForensicsAppendRecordInput;

const appendWithLog = async (
  runtimeLogger: RuntimeLogger | undefined,
  input: AppendableForensicsInput,
  capabilityLabel: "append-record" | "append-artifact",
  execute: () => Promise<ForensicsResult>,
): Promise<ForensicsResult> => {
  const span = runtimeLogger ? requireRuntimeLogWrite(runtimeLogger.startSpan({
    traceId: input.missionId,
    owner: "forensics-persistence",
    component: "forensics-persistence",
    operation: capabilityLabel === "append-record" ? "forensics.append-record" : "forensics.append-artifact",
    typedIdentity: {
      kind: "request",
      requestId: input.capabilityCallId ?? `${input.missionId}:${input.runId}`,
    },
    visibility: "DEBUG",
  })) : undefined;
  let result: ForensicsResult;
  try {
    result = await execute();
  } catch (error) {
    if (span) requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error,
        code: "FORENSICS_APPEND_FAILED",
        responsibleOwner: "forensics-persistence",
        recovery: RuntimeRecovery.STOP,
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    throw error;
  }
  if (!span) return result;
  if (result.status === "success") {
    requireRuntimeLogWrite(span.terminal({ outcome: "success" }));
  } else {
    requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(result.failureReason ?? "FORENSICS_APPEND_FAILED"),
        code: "FORENSICS_APPEND_FAILED",
        responsibleOwner: "forensics-persistence",
        recovery: RuntimeRecovery.STOP,
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
  }
  return result;
};

const appendRecordWithLog = async (
  input: ForensicsAppendRecordInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
) => {
  return appendWithLog(runtimeLogger, input, "append-record", () => executeAppendRecord(input, storage));
};

const appendArtifactWithLog = async (
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
) => {
  return appendWithLog(runtimeLogger, input, "append-artifact", () => executeAppendArtifact(input, storage));
};

const executeForensicsChild = (
  input: ForensicsAbilityInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
): Promise<ForensicsResult> => {
  switch (input.childCapabilityId) {
    case "append-record":
      return appendRecordWithLog(input, storage, runtimeLogger);
    case "append-artifact":
      return appendArtifactWithLog(input, storage, runtimeLogger);
    case "read-record-ref":
      return executeReadRecordRef(input, storage);
  }
};

export function createForensicsPersistenceAbilityGroup(
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
): ForensicsPersistenceAbilityGroup {
  return {
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,

    async execute(input: ForensicsAbilityInput): Promise<ForensicsResult> {
      return executeForensicsChild(input, storage, runtimeLogger);
    },

    async appendRecord(input): Promise<ForensicsResult> {
      const { correlationId, ...recordInput } = input;
      return appendRecordWithLog({
        ...recordInput,
        childCapabilityId: "append-record",
        ...(correlationId ? { capabilityCallId: correlationId } : {}),
      }, storage, runtimeLogger);
    },

    async appendArtifact(input): Promise<ForensicsResult> {
      return appendArtifactWithLog({
        ...input,
        childCapabilityId: "append-artifact",
      }, storage, runtimeLogger);
    },

    readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsResult> {
      return executeReadRecordRef(input, storage);
    },
  };
}

export function createForensicsPersistenceAbilityGroupFromStorage(
  storage: GrassEyeStoragePort,
  runtimeLogger?: RuntimeLogger,
): ForensicsPersistenceAbilityGroup {
  return createForensicsPersistenceAbilityGroup(createForensicsStorageAdapter(storage), runtimeLogger);
}
