import { createForensicsPersistenceRegistry } from "./registry.js";
import {
  type ForensicsAiResultRecordInput,
  type ForensicsBrowseLedgerInput,
  type ForensicsEvidencePacketInput,
  type ForensicsFailedRecordInput,
  type ForensicsImageEvidenceInput,
  type ForensicsOcrEvidenceInput,
  type ForensicsPersistenceAbilityGroup,
  type ForensicsPersistenceAbilityInput,
  type ForensicsRuntimeSnapshotInput,
  type ForensicsStructuredActionLogInput,
  type ForensicsStructuredRuntimeEventInput,
} from "./contract.js";
import { createForensicsExecutionContext, type CreateForensicsExecutionContextInput } from "./runtime/create-forensics-execution-context.js";
import { buildUnknownForensicsChildResult } from "./shared/forensics-unknown-child-result.js";

type CreateForensicsPersistenceAbilityGroupInput = CreateForensicsExecutionContextInput;

const createForensicsChildWriters = (execute: ForensicsPersistenceAbilityGroup["execute"]) => ({
  writeStructuredRuntimeEvent: (request: ForensicsStructuredRuntimeEventInput) => execute(request),
  writeStructuredActionLog: (request: ForensicsStructuredActionLogInput) => execute(request),
  writeImageEvidence: (request: ForensicsImageEvidenceInput) => execute(request),
  writeOcrEvidence: (request: ForensicsOcrEvidenceInput) => execute(request),
  writeAiResultRecord: (request: ForensicsAiResultRecordInput) => execute(request),
  finalizeBrowseLedger: (request: ForensicsBrowseLedgerInput) => execute(request),
  finalizeEvidencePacket: (request: ForensicsEvidencePacketInput) => execute(request),
  finalizeFailedRecord: (request: ForensicsFailedRecordInput) => execute(request),
  updateRuntimeSnapshot: (request: ForensicsRuntimeSnapshotInput) => execute(request),
});

export function createForensicsPersistenceAbilityGroup(input: CreateForensicsPersistenceAbilityGroupInput): ForensicsPersistenceAbilityGroup {
  const registry = createForensicsPersistenceRegistry();
  const context = createForensicsExecutionContext(input);

  const execute: ForensicsPersistenceAbilityGroup["execute"] = async (request) => {
    const capability = registry.get(request.childCapabilityId);
    if (!capability) {
      return buildUnknownForensicsChildResult({ request, clock: context.clock });
    }

    return capability.execute(request, context);
  };

  return {
    listChildCapabilityIds() {
      return [...registry.keys()];
    },
    execute,
    ...createForensicsChildWriters(execute),
  };
}
