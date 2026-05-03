import type { EvidenceStoreService } from "./evidence-store-service.js";
import { ActionLogSchema } from "../../../types/platform-action.js";
import { StructuredActionLogSchema } from "../../../types/structured-log.js";
import { ForensicsStructuredActionLogPayloadSchema, type ForensicsRecordEnvelope, type StoredForensicsRecord } from "./forensics-storage-types.js";

import { toStoredRecord } from "./forensics-record-storage-shared.js";

export async function persistStructuredActionLog(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsStructuredActionLogPayloadSchema.parse(envelope.payload);
  if (payload.actionLog) {
    await evidenceStore.saveActionLog(ActionLogSchema.parse(payload.actionLog));
  }
  await evidenceStore.saveStructuredActionLog(StructuredActionLogSchema.parse(payload.structuredActionLog));
  return toStoredRecord({ envelope, storageRef: null });
}