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

import { buildEvidenceStoreStorageRef } from "./forensics-durability-mode.js";
import { toStoredRecord } from "./forensics-record-storage-shared.js";

const rebuildAdvancedExportSetIfNeeded = async (evidenceStore: EvidenceStoreService, rebuildSessionId: string | null | undefined): Promise<void> => {
  if (rebuildSessionId) {
    await evidenceStore.rebuildAdvancedAiExportSet(rebuildSessionId);
  }
};

export async function persistBrowseLedgerRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsBrowseLedgerPayloadSchema.parse(envelope.payload);
  const browseLedgerEntry = await evidenceStore.saveBrowseLedgerEntry(BrowseLedgerEntrySchema.parse(payload.browseLedgerEntry));
  await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({
    envelope,
    storageRef: buildEvidenceStoreStorageRef({
      evidenceStore,
      collection: "browseLedger",
      itemId: `${browseLedgerEntry.sessionId}:${browseLedgerEntry.roundId}:${browseLedgerEntry.videoVisitId}`,
    }),
  });
}

export async function persistEvidencePacketRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsEvidencePacketPayloadSchema.parse(envelope.payload);
  const evidencePacket = await evidenceStore.saveEvidencePacket(ProductDiscoveryEvidencePacketSchema.parse(payload.evidencePacket));
  await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({
    envelope,
    storageRef: buildEvidenceStoreStorageRef({
      evidenceStore,
      collection: "evidencePackets",
      itemId: evidencePacket.packetId,
    }),
  });
}

export async function persistFailedRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsFailedRecordPayloadSchema.parse(envelope.payload);
  const evidencePacket = payload.evidencePacket
    ? await evidenceStore.saveEvidencePacket(ProductDiscoveryEvidencePacketSchema.parse(payload.evidencePacket))
    : null;
  const browseLedgerEntry = payload.browseLedgerEntry
    ? await evidenceStore.saveBrowseLedgerEntry(BrowseLedgerEntrySchema.parse(payload.browseLedgerEntry))
    : null;
  const roundStructuralLog = await evidenceStore.saveRoundStructuralLog(RoundStructuralLogSchema.parse(payload.roundStructuralLog));
  await rebuildAdvancedExportSetIfNeeded(evidenceStore, payload.rebuildSessionId);
  return toStoredRecord({
    envelope,
    storageRef: buildEvidenceStoreStorageRef({
      evidenceStore,
      collection: evidencePacket ? "evidencePackets" : browseLedgerEntry ? "browseLedger" : "roundStructuralLogs",
      itemId: evidencePacket?.packetId
        ?? (browseLedgerEntry ? `${browseLedgerEntry.sessionId}:${browseLedgerEntry.roundId}:${browseLedgerEntry.videoVisitId}` : null)
        ?? roundStructuralLog.logId,
    }),
  });
}
