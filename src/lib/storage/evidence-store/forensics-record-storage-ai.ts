import type { EvidenceStoreService } from "./evidence-store-service.js";
import { StoredAiResultSchema } from "../../../types/stored-ai-result.js";
import { ForensicsAiResultRecordPayloadSchema, type ForensicsRecordEnvelope, type StoredForensicsRecord } from "./forensics-storage-types.js";

import { toStoredRecord } from "./forensics-record-storage-shared.js";

export async function persistAiResultRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsAiResultRecordPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveAiResult(StoredAiResultSchema.parse(payload.aiResult));
  return toStoredRecord({ envelope, storageRef: null });
}