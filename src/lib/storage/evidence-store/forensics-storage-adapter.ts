import type { ImageEvidenceInput } from "./evidence-store-artifacts.js";
import { EvidenceStoreService } from "./evidence-store-service.js";
import type { ForensicsStoragePort, StoredForensicsRecord, ForensicsRecordQuery } from "../../../capabilities/forensics-persistence/storage-ports.js";
import type { ForensicsArtifactRef } from "../../../capabilities/forensics-persistence/shared/artifact-ref.js";
import type { ForensicsRecordEnvelope } from "../../../capabilities/forensics-persistence/shared/record-envelope.js";
import type { ForensicsRecordRef } from "../../../capabilities/forensics-persistence/shared/record-ref.js";
import type { StructuredRuntimeEvent } from "../../../types/structured-log.js";
import type { OcrTextResult } from "../../../types/evidence.js";

type EnvelopePayloadRecord = Record<string, unknown>;

function asObject(value: unknown): EnvelopePayloadRecord {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  return value as EnvelopePayloadRecord;
}

function buildRecordRef(envelope: ForensicsRecordEnvelope, storageRef: string | null): ForensicsRecordRef {
  return { recordType: envelope.recordType, recordId: envelope.recordId, storageRef };
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

export function createEvidenceStoreForensicsStoragePort(evidenceStore: EvidenceStoreService): ForensicsStoragePort {
  return {
    async writeRecord(envelope) {
      const payload = asObject(envelope.payload);

      switch (envelope.recordType) {
        case "structured_runtime_event": {
          const structuredRuntimeEvent = payload.structuredRuntimeEvent as StructuredRuntimeEvent;
          await evidenceStore.saveStructuredRuntimeEvent(structuredRuntimeEvent);
          const roundLifecycleEvent = payload.roundLifecycleEvent;
          if (roundLifecycleEvent) {
            await evidenceStore.saveRoundLifecycleEvent(roundLifecycleEvent as never);
          }
          return toStoredRecord({ envelope, storageRef: null });
        }
        case "structured_action_log": {
          const actionLog = payload.actionLog;
          if (actionLog) {
            await evidenceStore.saveActionLog(actionLog as never);
          }
          await evidenceStore.saveStructuredActionLog(payload.structuredActionLog as never);
          return toStoredRecord({ envelope, storageRef: null });
        }
        case "evidence_record": {
          if (payload.imageEvidenceInput) {
            const savedImage = await evidenceStore.saveImageEvidence(payload.imageEvidenceInput as ImageEvidenceInput);
            return toStoredRecord({
              envelope,
              storageRef: savedImage.filePath,
              artifactRefs: [{ artifactType: "image", artifactId: savedImage.id, storageRef: savedImage.filePath }],
            });
          }

          const savedOcr = await evidenceStore.saveOcrResult(payload.ocrTextResult as OcrTextResult);
          return toStoredRecord({ envelope, storageRef: null, artifactRefs: envelope.artifactRefs, });
        }
        case "ai_result_record": {
          await evidenceStore.saveAiResult(payload.aiResult as never);
          return toStoredRecord({ envelope, storageRef: null });
        }
        case "browse_ledger_entry": {
          await evidenceStore.saveBrowseLedgerEntry(payload.browseLedgerEntry as never);
          if (payload.roundStructuralLog) {
            await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog as never);
          }
          return toStoredRecord({ envelope, storageRef: null });
        }
        case "evidence_packet": {
          await evidenceStore.saveEvidencePacket(payload.evidencePacket as never);
          if (payload.roundStructuralLog) {
            await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog as never);
          }
          if (payload.rebuildSessionId && typeof payload.rebuildSessionId === "string") {
            await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
          }
          return toStoredRecord({ envelope, storageRef: null, artifactRefs: envelope.artifactRefs });
        }
        case "failed_record": {
          if (payload.browseLedgerEntry) {
            await evidenceStore.saveBrowseLedgerEntry(payload.browseLedgerEntry as never);
          }
          if (payload.evidencePacket) {
            await evidenceStore.saveEvidencePacket(payload.evidencePacket as never);
          }
          if (payload.roundStructuralLog) {
            await evidenceStore.saveRoundStructuralLog(payload.roundStructuralLog as never);
          }
          if (payload.rebuildSessionId && typeof payload.rebuildSessionId === "string") {
            await evidenceStore.rebuildAdvancedAiExportSet(payload.rebuildSessionId);
          }
          return toStoredRecord({ envelope, storageRef: null, artifactRefs: envelope.artifactRefs });
        }
        case "runtime_snapshot": {
          await evidenceStore.saveStructuredRuntimeEvent(payload.snapshotEvent as never);
          return toStoredRecord({ envelope, storageRef: null });
        }
        default:
          throw new Error(`Unsupported Forensics record type: ${envelope.recordType}`);
      }
    },
    async readRecord(_ref) {
      return null;
    },
    async listRecords(_query: ForensicsRecordQuery) {
      return [];
    },
    async writeArtifactRef(artifact) {
      return artifact;
    },
    updateRuntimeSnapshot(envelope) {
      return this.writeRecord(envelope);
    },
  };
}