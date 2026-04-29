import type { ForensicsPersistenceChildCapability, ForensicsPersistenceChildCapabilityId } from "./contract.js";
import { finalizeBrowseLedgerCapability } from "./children/finalize-browse-ledger/implementation.js";
import { finalizeEvidencePacketCapability } from "./children/finalize-evidence-packet/implementation.js";
import { finalizeFailedRecordCapability } from "./children/finalize-failed-record/implementation.js";
import { updateRuntimeSnapshotCapability } from "./children/update-runtime-snapshot/implementation.js";
import { writeAiResultRecordCapability } from "./children/write-ai-result-record/implementation.js";
import { writeEvidenceRecordCapability } from "./children/write-evidence-record/implementation.js";
import { writeStructuredActionLogCapability } from "./children/write-structured-action-log/implementation.js";
import { writeStructuredRuntimeEventCapability } from "./children/write-structured-runtime-event/implementation.js";

const CHILDREN = [
  writeStructuredRuntimeEventCapability,
  writeStructuredActionLogCapability,
  writeEvidenceRecordCapability,
  writeAiResultRecordCapability,
  finalizeBrowseLedgerCapability,
  finalizeEvidencePacketCapability,
  finalizeFailedRecordCapability,
  updateRuntimeSnapshotCapability,
] as const;

export function createForensicsPersistenceRegistry(): Map<ForensicsPersistenceChildCapabilityId, ForensicsPersistenceChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listForensicsPersistenceChildren(): ForensicsPersistenceChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}
