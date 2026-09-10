import { executeAppendArtifact } from "./children/append-artifact/handler.js";
import { executeAppendRecord } from "./children/append-record/handler.js";
import { executeReadArtifactRef } from "./children/read-artifact-ref/handler.js";
import { executeReadRecordRef } from "./children/read-record-ref/handler.js";
import type { ForensicsPersistenceAbilityGroup } from "./contract.js";
import { createForensicsStorageAdapter } from "./storage-adapter.js";
import type {
  ForensicsAppendArtifactInput,
  ForensicsAppendArtifactResult,
  ForensicsAppendRecordInput,
  ForensicsAppendRecordResult,
  ForensicsReadArtifactResult,
  ForensicsReadRecordResult,
  ForensicsReadRecordRefInput,
} from "./schema.js";
import type { ForensicsStoragePort } from "./storage-port.js";
import type { GrassEyeStoragePort } from "../../lib/storage/index.js";
import {
  RuntimeFailureImpact,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogger,
} from "../../lib/runtime-logs/index.js";

type AppendableForensicsInput =
  | ForensicsAppendArtifactInput
  | ForensicsAppendRecordInput;

const appendWithLog = async <T extends Readonly<{ status: "success" | "failed"; failureReason?: string }>>(
  runtimeLogger: RuntimeLogger | undefined,
  input: AppendableForensicsInput,
  capabilityLabel: "append-record" | "append-artifact",
  execute: () => Promise<T>,
): Promise<T> => {
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
  let result: T;
  try {
    result = await execute();
  } catch (error) {
    if (span) requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error,
        code: "FORENSICS_APPEND_FAILED",
        responsibleOwner: "forensics-persistence",
        impact: RuntimeFailureImpact.BLOCKING,
      }),
    }));
    throw error;
  }
  if (!span) return result;
  if (result.status === "success") {
    requireRuntimeLogWrite(span.terminal({ outcome: "succeeded" }));
  } else {
    requireRuntimeLogWrite(span.terminal({
      outcome: "failed",
      failure: runtimeFailureFromError({
        error: new Error(result.failureReason ?? "FORENSICS_APPEND_FAILED"),
        code: "FORENSICS_APPEND_FAILED",
        responsibleOwner: "forensics-persistence",
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
): Promise<ForensicsAppendRecordResult> => {
  return appendWithLog(runtimeLogger, input, "append-record", () => executeAppendRecord(input, storage));
};

const appendArtifactWithLog = async (
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
): Promise<ForensicsAppendArtifactResult> => {
  return appendWithLog(runtimeLogger, input, "append-artifact", () => executeAppendArtifact(input, storage));
};

export function createForensicsPersistenceAbilityGroup(
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
): ForensicsPersistenceAbilityGroup {
  return {
    async appendRecord(input): Promise<ForensicsAppendRecordResult> {
      const { correlationId, ...recordInput } = input;
      return appendRecordWithLog({
        ...recordInput,
        ...(correlationId ? { capabilityCallId: correlationId } : {}),
      }, storage, runtimeLogger);
    },

    async appendArtifact(input): Promise<ForensicsAppendArtifactResult> {
      const { correlationId, ...artifactInput } = input;
      return appendArtifactWithLog({
        ...artifactInput,
        ...(correlationId ? { capabilityCallId: correlationId } : {}),
      }, storage, runtimeLogger);
    },

    readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsReadRecordResult> {
      return executeReadRecordRef(input, storage);
    },

    readArtifactRef(input): Promise<ForensicsReadArtifactResult> {
      return executeReadArtifactRef(input, storage);
    },

    async readExactCallEvidence(input) {
      const terminal = await storage.readRecordByIdentity({
        missionId: input.missionId,
        runId: input.runId,
        idempotencyKey: `gpt-call-terminal-evidence:v1:${input.exactCallIdentityHash}`,
      });
      return terminal ?? storage.readRecordByIdentity({
        missionId: input.missionId,
        runId: input.runId,
        idempotencyKey: `gpt-call-evidence:v1:${input.exactCallIdentityHash}`,
      });
    },
  };
}

export function createForensicsPersistenceAbilityGroupFromStorage(
  storage: GrassEyeStoragePort,
  runtimeLogger?: RuntimeLogger,
): ForensicsPersistenceAbilityGroup {
  return createForensicsPersistenceAbilityGroup(createForensicsStorageAdapter(storage), runtimeLogger);
}
