import { executeAppendArtifact } from "./children/append-artifact.js";
import { executeAppendRecord } from "./children/append-record.js";
import { executeReadRecordRef } from "./children/read-record-ref.js";
import type { ForensicsPersistenceAbilityGroup } from "./contract.js";
import type {
  ForensicsAbilityInput,
  ForensicsAppendArtifactInput,
  ForensicsAppendRecordInput,
  ForensicsReadRecordRefInput,
  ForensicsResult,
} from "./schema.js";
import { FORENSICS_PERSISTENCE_ABILITY_GROUP_ID } from "./schema.js";
import type { ForensicsStoragePort } from "./storage-port.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../lib/runtime-logs/index.js";

type AppendableForensicsInput =
  | ForensicsAppendArtifactInput
  | ForensicsAppendRecordInput;

const emitAppendSuccess = (
  runtimeLogger: RuntimeLogger | undefined,
  input: AppendableForensicsInput,
  eventType: typeof RuntimeLogEventType.FORENSICS_RECORD_APPENDED | typeof RuntimeLogEventType.FORENSICS_ARTIFACT_APPENDED,
  capabilityLabel: "append-record" | "append-artifact",
) => {
  if (!runtimeLogger) {
    return;
  }

  const baseEvent: Omit<Parameters<RuntimeLogger["emit"]>[0], "roundId"> = {
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType,
    owner: "forensics-persistence",
    missionId: input.missionId,
    runId: input.runId,
    status: "success",
    reason: `${capabilityLabel} ok callId=${input.capabilityCallId ?? "?"}`,
  };

  runtimeLogger.emit(input.roundId ? { ...baseEvent, roundId: input.roundId } : baseEvent);
};

const appendRecordWithLog = async (
  input: ForensicsAppendRecordInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
) => {
  const result = await executeAppendRecord(input, storage);
  if (result.status === "success") {
    emitAppendSuccess(
      runtimeLogger,
      input,
      RuntimeLogEventType.FORENSICS_RECORD_APPENDED,
      "append-record",
    );
  }
  return result;
};

const appendArtifactWithLog = async (
  input: ForensicsAppendArtifactInput,
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
) => {
  const result = await executeAppendArtifact(input, storage);
  if (result.status === "success") {
    emitAppendSuccess(
      runtimeLogger,
      input,
      RuntimeLogEventType.FORENSICS_ARTIFACT_APPENDED,
      "append-artifact",
    );
  }
  return result;
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

    async appendRecord(input: ForensicsAppendRecordInput): Promise<ForensicsResult> {
      return appendRecordWithLog(input, storage, runtimeLogger);
    },

    async appendArtifact(input: ForensicsAppendArtifactInput): Promise<ForensicsResult> {
      return appendArtifactWithLog(input, storage, runtimeLogger);
    },

    readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsResult> {
      return executeReadRecordRef(input, storage);
    },
  };
}
