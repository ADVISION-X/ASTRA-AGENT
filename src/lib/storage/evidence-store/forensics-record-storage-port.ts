import type { EvidenceStoreService } from "./evidence-store-service.js";
import {
  type ForensicsRecordEnvelope,
  type ForensicsRecordQuery,
  type ForensicsStoragePort,
  type StoredForensicsRecord,
} from "./forensics-storage-types.js";
import { persistStructuredActionLog } from "./forensics-record-storage-action.js";
import { persistAiResultRecord } from "./forensics-record-storage-ai.js";
import { persistEvidenceRecord } from "./forensics-record-storage-evidence.js";
import { persistBrowseLedgerRecord, persistEvidencePacketRecord, persistFailedRecord } from "./forensics-record-storage-ledger.js";
import { persistRuntimeSnapshot, persistStructuredRuntimeEvent } from "./forensics-record-storage-runtime.js";

const RECORD_PERSISTERS = {
  structured_runtime_event: persistStructuredRuntimeEvent,
  structured_action_log: persistStructuredActionLog,
  evidence_record: persistEvidenceRecord,
  ai_result_record: persistAiResultRecord,
  browse_ledger_entry: persistBrowseLedgerRecord,
  evidence_packet: persistEvidencePacketRecord,
  failed_record: persistFailedRecord,
  runtime_snapshot: persistRuntimeSnapshot,
} as const;

async function persistEnvelope(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  return RECORD_PERSISTERS[envelope.recordType](evidenceStore, envelope);
}

export function createEvidenceStoreForensicsRecordStoragePort(evidenceStore: EvidenceStoreService): ForensicsStoragePort {
  const persist = (envelope: ForensicsRecordEnvelope) => persistEnvelope(evidenceStore, envelope);
  return {
    async writeRecord(input) {
      return persist(input.envelope);
    },
    updateRuntimeSnapshot: persist,
    async readRecord(_ref) {
      return null;
    },
    async listRecords(_query: ForensicsRecordQuery) {
      return [];
    },
  };
}