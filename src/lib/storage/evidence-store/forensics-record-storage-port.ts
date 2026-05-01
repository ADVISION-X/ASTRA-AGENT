import { EvidenceStoreService } from "./evidence-store-service.js";
import {
  ForensicsAiResultRecordPayloadSchema,
  ForensicsArtifactRefSchema,
  ForensicsBrowseLedgerPayloadSchema,
  ForensicsEvidencePacketPayloadSchema,
  ForensicsEvidenceRecordPayloadSchema,
  ForensicsFailedRecordPayloadSchema,
  ForensicsRuntimeSnapshotPayloadSchema,
  ForensicsStructuredActionLogPayloadSchema,
  ForensicsStructuredRuntimeEventPayloadSchema,
} from "../../../capabilities/forensics-persistence/schema.js";
import type {
  ForensicsArtifactRef,
  ForensicsRecordEnvelope,
  ForensicsRecordQuery,
  ForensicsRecordRef,
  StoredForensicsRecord,
} from "../../../capabilities/forensics-persistence/schema.js";
import type { ForensicsStoragePort } from "../../../capabilities/forensics-persistence/ports/forensics-storage-port.js";

function buildRecordRef(envelope: ForensicsRecordEnvelope, storageRef: string | null): ForensicsRecordRef {
  return {
    recordType: envelope.recordType,
    recordId: envelope.recordId,
    storageRef,
  };
}

function toStoredRecord(input: {
  envelope: ForensicsRecordEnvelope;
  storageRef: string | null;
  artifactRefs?: ForensicsArtifactRef[];
}): StoredForensicsRecord {
  return {
    recordRef: buildRecordRef(input.envelope, input.storageRef),
    storageRef: input.storageRef,
    envelope: input.envelope,
    artifactRefs: input.artifactRefs ?? input.envelope.artifactRefs,
    persistedAt: new Date().toISOString(),
  };
}

async function persistStructuredRuntimeEvent(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsStructuredRuntimeEventPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveStructuredRuntimeEvent(payload.structuredRuntimeEvent);
  if (payload.roundLifecycleEvent) {
    await evidenceStore.saveRoundLifecycleEvent(payload.roundLifecycleEvent);
  }
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistStructuredActionLog(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsStructuredActionLogPayloadSchema.parse(envelope.payload);
  if (payload.actionLog) {
    await evidenceStore.saveActionLog(payload.actionLog);
  }
  await evidenceStore.saveStructuredActionLog(payload.structuredActionLog);
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistEvidenceRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsEvidenceRecordPayloadSchema.parse(envelope.payload);
  if ("imageEvidenceInput" in payload) {
    const imageEvidenceInput = {
      kind: payload.imageEvidenceInput.kind,
      taskRunId: payload.imageEvidenceInput.taskRunId,
      roundId: payload.imageEvidenceInput.roundId,
      platformId: payload.imageEvidenceInput.platformId,
      sourceId: payload.imageEvidenceInput.sourceId,
      sourceUrl: payload.imageEvidenceInput.sourceUrl,
      regionLabel: payload.imageEvidenceInput.regionLabel,
      regionType: payload.imageEvidenceInput.regionType,
      summary: payload.imageEvidenceInput.summary,
      width: payload.imageEvidenceInput.width,
      height: payload.imageEvidenceInput.height,
      ...(payload.imageEvidenceInput.contentLines ? { contentLines: payload.imageEvidenceInput.contentLines } : {}),
      ...(payload.imageEvidenceInput.sourceFilePath ? { sourceFilePath: payload.imageEvidenceInput.sourceFilePath } : {}),
    };
    const savedImage = await evidenceStore.saveImageEvidence(imageEvidenceInput);
    return toStoredRecord({
      envelope,
      storageRef: savedImage.filePath,
      artifactRefs: [
        {
          artifactType: "image",
          artifactId: savedImage.id,
          storageRef: savedImage.filePath,
          sourceRecordRef: buildRecordRef(envelope, savedImage.filePath),
        },
      ],
    });
  }

  await evidenceStore.saveOcrResult(payload.ocrTextResult);
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistAiResultRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsAiResultRecordPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveAiResult(payload.aiResult);
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistBrowseLedgerRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsBrowseLedgerPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveBrowseLedgerEntry(payload.browseLedgerEntry);
  await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog);
  if (payload.rebuildSessionId) {
    await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
  }
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistEvidencePacketRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsEvidencePacketPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveEvidencePacket(payload.evidencePacket);
  await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog);
  if (payload.rebuildSessionId) {
    await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
  }
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistFailedRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsFailedRecordPayloadSchema.parse(envelope.payload);
  if (payload.evidencePacket) {
    await evidenceStore.saveEvidencePacket(payload.evidencePacket);
  }
  if (payload.browseLedgerEntry) {
    await evidenceStore.saveBrowseLedgerEntry(payload.browseLedgerEntry);
  }
  await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog);
  if (payload.rebuildSessionId) {
    await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
  }
  return toStoredRecord({ envelope, storageRef: null });
}

async function persistRuntimeSnapshot(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsRuntimeSnapshotPayloadSchema.parse(envelope.payload);
  await evidenceStore.saveStructuredRuntimeEvent(payload.snapshotEvent);
  return toStoredRecord({ envelope, storageRef: null });
}

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
    appendRecord: persist,
    replaceRecordByRound: persist,
    replaceRecordBySession: persist,
    updateRuntimeSnapshot: persist,
    async readRecord(_ref) {
      return null;
    },
    async listRecords(_query: ForensicsRecordQuery) {
      return [];
    },
  };
}