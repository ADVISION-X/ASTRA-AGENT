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
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";

export function createForensicsPersistenceAbilityGroup(
  storage: ForensicsStoragePort,
  runtimeLogger?: RuntimeLogger,
): ForensicsPersistenceAbilityGroup {
  return {
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,

    async execute(input: ForensicsAbilityInput): Promise<ForensicsResult> {
      switch (input.childCapabilityId) {
        case "append-record": {
          const r = await executeAppendRecord(input, storage);
          if (r.status === "success") {
            runtimeLogger?.emit({
              traceId: input.missionId,
              level: "debug",
              modeVisibility: ["DEBUG", "TRACE"],
              eventType: "FORENSICS_RECORD_APPENDED",
              owner: "forensics-persistence",
              missionId: input.missionId,
              runId: input.runId,
              ...(input.roundId ? { roundId: input.roundId } : {}),
              status: "success",
              reason: `append-record ok callId=${input.capabilityCallId ?? "?"}`,
            });
          }
          return r;
        }
        case "append-artifact": {
          const r = await executeAppendArtifact(input, storage);
          if (r.status === "success") {
            runtimeLogger?.emit({
              traceId: input.missionId,
              level: "debug",
              modeVisibility: ["DEBUG", "TRACE"],
              eventType: "FORENSICS_ARTIFACT_APPENDED",
              owner: "forensics-persistence",
              missionId: input.missionId,
              runId: input.runId,
              ...(input.roundId ? { roundId: input.roundId } : {}),
              status: "success",
              reason: `append-artifact ok callId=${input.capabilityCallId ?? "?"}`,
            });
          }
          return r;
        }
        case "read-record-ref":
          return executeReadRecordRef(input, storage);
      }
    },

    async appendRecord(input: ForensicsAppendRecordInput): Promise<ForensicsResult> {
      const r = await executeAppendRecord(input, storage);
      if (r.status === "success") {
        runtimeLogger?.emit({
          traceId: input.missionId,
          level: "debug",
          modeVisibility: ["DEBUG", "TRACE"],
          eventType: "FORENSICS_RECORD_APPENDED",
          owner: "forensics-persistence",
          missionId: input.missionId,
          runId: input.runId,
          ...(input.roundId ? { roundId: input.roundId } : {}),
          status: "success",
          reason: `append-record ok callId=${input.capabilityCallId ?? "?"}`,
        });
      }
      return r;
    },

    async appendArtifact(input: ForensicsAppendArtifactInput): Promise<ForensicsResult> {
      const r = await executeAppendArtifact(input, storage);
      if (r.status === "success") {
        runtimeLogger?.emit({
          traceId: input.missionId,
          level: "debug",
          modeVisibility: ["DEBUG", "TRACE"],
          eventType: "FORENSICS_ARTIFACT_APPENDED",
          owner: "forensics-persistence",
          missionId: input.missionId,
          runId: input.runId,
          ...(input.roundId ? { roundId: input.roundId } : {}),
          status: "success",
          reason: `append-artifact ok callId=${input.capabilityCallId ?? "?"}`,
        });
      }
      return r;
    },

    readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsResult> {
      return executeReadRecordRef(input, storage);
    },
  };
}
