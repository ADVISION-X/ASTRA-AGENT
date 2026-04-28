import type {
  ForensicsAiResultRecordInput,
  ForensicsBrowseLedgerInput,
  ForensicsEvidencePacketInput,
  ForensicsFailedRecordInput,
  ForensicsImageEvidenceInput,
  ForensicsOcrEvidenceInput,
  ForensicsPersistenceAbilityGroup,
  ForensicsPersistenceAbilityInput,
  ForensicsRuntimeSnapshotInput,
  ForensicsStructuredActionLogInput,
  ForensicsStructuredRuntimeEventInput,
} from "./contract.js";
import { createForensicsPersistenceRegistry } from "./registry.js";
import type { ForensicsStoragePort } from "./storage-ports.js";

type CreateForensicsPersistenceAbilityGroupInput = {
  storage: ForensicsStoragePort;
};

export function createForensicsPersistenceAbilityGroup(input: CreateForensicsPersistenceAbilityGroupInput): ForensicsPersistenceAbilityGroup {
  const registry = createForensicsPersistenceRegistry();
  const context = { storage: input.storage };

  const execute = async (request: ForensicsPersistenceAbilityInput) => {
    const capability = registry.get(request.childCapabilityId);
    if (!capability) {
      throw new Error(`Forensics Persistence child capability is not registered for ${request.childCapabilityId}.`);
    }

    return capability.execute(request, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute,
    writeStructuredRuntimeEvent(request: ForensicsStructuredRuntimeEventInput) {
      return execute(request);
    },
    writeStructuredActionLog(request: ForensicsStructuredActionLogInput) {
      return execute(request);
    },
    writeImageEvidence(request: ForensicsImageEvidenceInput) {
      return execute(request);
    },
    writeOcrEvidence(request: ForensicsOcrEvidenceInput) {
      return execute(request);
    },
    writeAiResultRecord(request: ForensicsAiResultRecordInput) {
      return execute(request);
    },
    finalizeBrowseLedger(request: ForensicsBrowseLedgerInput) {
      return execute(request);
    },
    finalizeEvidencePacket(request: ForensicsEvidencePacketInput) {
      return execute(request);
    },
    finalizeFailedRecord(request: ForensicsFailedRecordInput) {
      return execute(request);
    },
    updateRuntimeSnapshot(request: ForensicsRuntimeSnapshotInput) {
      return execute(request);
    },
  };
}