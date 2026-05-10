import type { EvidenceStoreService } from "./evidence-store-service.js";
import { ForensicsProductLeadRecordPayloadSchema, type ForensicsRecordEnvelope, type StoredForensicsRecord } from "./forensics-storage-types.js";

import { buildEvidenceStoreStorageRef } from "./forensics-durability-mode.js";
import { toStoredRecord } from "./forensics-record-storage-shared.js";

export async function persistProductLeadRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsProductLeadRecordPayloadSchema.parse(envelope.payload);
  const productLeadRecord = await evidenceStore.saveProductLeadRecord({
    recordId: envelope.recordId,
    roundId: envelope.roundId,
    sessionId: envelope.sessionId,
    stepId: envelope.stepId,
    ...payload.productLeadRecord,
  });

  return toStoredRecord({
    envelope,
    storageRef: buildEvidenceStoreStorageRef({
      evidenceStore,
      collection: "productLeadRecords",
      itemId: productLeadRecord.recordId,
    }),
  });
}