import type { EvidenceStoreService } from "./evidence-store-service.js";
import { RoundLifecycleEventSchema } from "../../../types/evidence-packet.js";
import { StructuredRuntimeEventSchema } from "../../../types/structured-log.js";
import { ForensicsRuntimeSnapshotPayloadSchema, ForensicsStructuredRuntimeEventPayloadSchema, type ForensicsRecordEnvelope, type StoredForensicsRecord } from "./forensics-storage-types.js";

import { toStoredRecord } from "./forensics-record-storage-shared.js";

export async function persistStructuredRuntimeEvent(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsStructuredRuntimeEventPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveStructuredRuntimeEvent(StructuredRuntimeEventSchema.parse(payload.structuredRuntimeEvent));
  if (payload.roundLifecycleEvent) {
    await evidenceStore.saveRoundLifecycleEvent(RoundLifecycleEventSchema.parse(payload.roundLifecycleEvent));
  }
  return toStoredRecord({ envelope, storageRef: null });
}

export async function persistRuntimeSnapshot(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsRuntimeSnapshotPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveStructuredRuntimeEvent(StructuredRuntimeEventSchema.parse(payload.snapshotEvent));
  return toStoredRecord({ envelope, storageRef: null });
}