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

export function createForensicsPersistenceAbilityGroup(
  storage: ForensicsStoragePort,
): ForensicsPersistenceAbilityGroup {
  return {
    abilityGroupId: FORENSICS_PERSISTENCE_ABILITY_GROUP_ID,

    async execute(input: ForensicsAbilityInput): Promise<ForensicsResult> {
      switch (input.childCapabilityId) {
        case "append-record":
          return executeAppendRecord(input, storage);
        case "append-artifact":
          return executeAppendArtifact(input, storage);
        case "read-record-ref":
          return executeReadRecordRef(input, storage);
      }
    },

    appendRecord(input: ForensicsAppendRecordInput): Promise<ForensicsResult> {
      return executeAppendRecord(input, storage);
    },

    appendArtifact(input: ForensicsAppendArtifactInput): Promise<ForensicsResult> {
      return executeAppendArtifact(input, storage);
    },

    readRecordRef(input: ForensicsReadRecordRefInput): Promise<ForensicsResult> {
      return executeReadRecordRef(input, storage);
    },
  };
}
