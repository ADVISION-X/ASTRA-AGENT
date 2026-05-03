import type { EvidenceStoreService } from "./evidence-store-service.js";
import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundStructuralLogSchema,
} from "../../../types/evidence-packet.js";
import {
  ForensicsBrowseLedgerPayloadSchema,
  ForensicsEvidencePacketPayloadSchema,
  ForensicsFailedRecordPayloadSchema,
  type ForensicsRecordEnvelope,
  type StoredForensicsRecord,
} from "./forensics-storage-types.js";

import { toStoredRecord } from "./forensics-record-storage-shared.js";

const rebuildAdvancedExportSetIfNeeded = async (evidenceStore: EvidenceStoreService, rebuildSessionId: string | null | undefined): Promise<void> => {
  if (rebuildSessionId) {
    await evidenceStore.rebuildAdvancedAiExportSet(rebuildSessionId);
  }
};

export async function persistBrowseLedgerRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsBrowseLedgerPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveBrowseLedgerEntry(BrowseLedgerEntrySchema.parse(payload.browseLedgerEntry));
  await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({ envelope, storageRef: null });
}

export async function persistEvidencePacketRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsEvidencePacketPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveEvidencePacket(ProductDiscoveryEvidencePacketSchema.parse(payload.evidencePacket));
  await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({ envelope, storageRef: null });
}

export async function persistFailedRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsFailedRecordPayloadSchema.parse(envelope.payload);
  if (payload.evidencePacket) {
    await evidenceStore.saveEvidencePacket(ProductDiscoveryEvidencePacketSchema.parse(payload.evidencePacket));
  }
  if (payload.browseLedgerEntry) {
    await evidenceStore.saveBrowseLedgerEntry(BrowseLedgerEntrySchema.parse(payload.browseLedgerEntry));
  }
  await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({ envelope, storageRef: null });
}