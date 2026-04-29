import { access } from "node:fs/promises";

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
import type { ForensicsArtifactStoragePort } from "../../../capabilities/forensics-persistence/ports/forensics-artifact-storage-port.js";
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

async function persistEnvelope(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  switch (envelope.recordType) {
    case "structured_runtime_event": {
      const payload = ForensicsStructuredRuntimeEventPayloadSchema.parse(envelope.payload);
      await evidenceStore.saveStructuredRuntimeEvent(payload.structuredRuntimeEvent);
      if (payload.roundLifecycleEvent) {
        await evidenceStore.saveRoundLifecycleEvent(payload.roundLifecycleEvent);
      }
      return toStoredRecord({ envelope, storageRef: null });
    }
    case "structured_action_log": {
      const payload = ForensicsStructuredActionLogPayloadSchema.parse(envelope.payload);
      if (payload.actionLog) {
        await evidenceStore.saveActionLog(payload.actionLog);
      }
      await evidenceStore.saveStructuredActionLog(payload.structuredActionLog);
      return toStoredRecord({ envelope, storageRef: null });
    }
    case "evidence_record": {
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
    case "ai_result_record": {
      const payload = ForensicsAiResultRecordPayloadSchema.parse(envelope.payload);
      await evidenceStore.saveAiResult(payload.aiResult);
      return toStoredRecord({ envelope, storageRef: null });
    }
    case "browse_ledger_entry": {
      const payload = ForensicsBrowseLedgerPayloadSchema.parse(envelope.payload);
      await evidenceStore.saveBrowseLedgerEntry(payload.browseLedgerEntry);
      await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog);
      if (payload.rebuildSessionId) {
        await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
      }
      return toStoredRecord({ envelope, storageRef: null });
    }
    case "evidence_packet": {
      const payload = ForensicsEvidencePacketPayloadSchema.parse(envelope.payload);
      await evidenceStore.saveEvidencePacket(payload.evidencePacket);
      await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog);
      if (payload.rebuildSessionId) {
        await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
      }
      return toStoredRecord({ envelope, storageRef: null });
    }
    case "failed_record": {
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
    case "runtime_snapshot": {
      const payload = ForensicsRuntimeSnapshotPayloadSchema.parse(envelope.payload);
      await evidenceStore.saveStructuredRuntimeEvent(payload.snapshotEvent);
      return toStoredRecord({ envelope, storageRef: null });
    }
  }
}

export function createEvidenceStoreForensicsRecordStoragePort(evidenceStore: EvidenceStoreService): ForensicsStoragePort {
  return {
    appendRecord(envelope) {
      return persistEnvelope(evidenceStore, envelope);
    },
    replaceRecordByRound(envelope) {
      return persistEnvelope(evidenceStore, envelope);
    },
    replaceRecordBySession(envelope) {
      return persistEnvelope(evidenceStore, envelope);
    },
    updateRuntimeSnapshot(envelope) {
      return persistEnvelope(evidenceStore, envelope);
    },
    async readRecord(_ref) {
      return null;
    },
    async listRecords(_query: ForensicsRecordQuery) {
      return [];
    },
  };
}

export function createEvidenceStoreForensicsArtifactStoragePort(): ForensicsArtifactStoragePort {
  return {
    async writeArtifactRef(input) {
      const artifactRef = ForensicsArtifactRefSchema.parse(input);
      if (!artifactRef.storageRef) {
        throw new Error(`Artifact ${artifactRef.artifactId} cannot be persisted without storageRef.`);
      }
      return artifactRef;
    },
    async verifyArtifactRef(input) {
      const artifactRef = ForensicsArtifactRefSchema.parse(input);
      if (!artifactRef.storageRef) {
        return false;
      }
      try {
        await access(artifactRef.storageRef);
        return true;
      } catch {
        return false;
      }
    },
  };
}
