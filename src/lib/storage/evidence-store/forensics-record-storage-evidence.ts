import type { EvidenceStoreService } from "./evidence-store-service.js";
import { OcrTextResultSchema } from "../../../types/evidence.js";
import { ForensicsEvidenceRecordPayloadSchema, type ForensicsRecordEnvelope, type StoredForensicsRecord } from "./forensics-storage-types.js";

import { buildEvidenceStoreStorageRef } from "./forensics-durability-mode.js";
import { buildRecordRef, toStoredRecord } from "./forensics-record-storage-shared.js";

const buildImageEvidenceInput = (imageEvidenceInput: {
  kind: "video-screenshot" | "comment-screenshot";
  taskRunId: string;
  roundId: string;
  platformId: string;
  sourceId: string;
  sourceUrl: string;
  regionLabel: string;
  regionType: string;
  summary: string;
  width: number;
  height: number;
  contentLines?: string[] | undefined;
  sourceFilePath?: string | undefined;
}) => ({
  kind: imageEvidenceInput.kind,
  taskRunId: imageEvidenceInput.taskRunId,
  roundId: imageEvidenceInput.roundId,
  platformId: imageEvidenceInput.platformId,
  sourceId: imageEvidenceInput.sourceId,
  sourceUrl: imageEvidenceInput.sourceUrl,
  regionLabel: imageEvidenceInput.regionLabel,
  regionType: imageEvidenceInput.regionType,
  summary: imageEvidenceInput.summary,
  width: imageEvidenceInput.width,
  height: imageEvidenceInput.height,
  ...(imageEvidenceInput.contentLines ? { contentLines: imageEvidenceInput.contentLines } : {}),
  ...(imageEvidenceInput.sourceFilePath ? { sourceFilePath: imageEvidenceInput.sourceFilePath } : {}),
});

export async function persistEvidenceRecord(evidenceStore: EvidenceStoreService, envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord> {
  const payload = ForensicsEvidenceRecordPayloadSchema.parse(envelope.payload);
  if ("imageEvidenceInput" in payload) {
    const savedImage = await evidenceStore.saveImageEvidence(buildImageEvidenceInput(payload.imageEvidenceInput));
    return toStoredRecord({
      envelope,
      storageRef: savedImage.filePath,
      artifactRefs: [{
        artifactType: "image",
        artifactId: savedImage.id,
        storageRef: savedImage.filePath,
        sourceRecordRef: buildRecordRef(envelope, savedImage.filePath),
        artifactLifecycleManifestRef: null,
        retentionClass: null,
        promotionStatus: "not_promoted",
        artifactHash: null,
        byteSize: null,
        promotedByRecordRef: null,
        pinnedByRecordRefs: [],
        legalHoldReason: null,
        cleanupLedgerRef: null,
        refCount: 0,
        cleanupEligible: false,
      }],
    });
  }

  const ocrResult = await evidenceStore.saveOcrResult(OcrTextResultSchema.parse(payload.ocrTextResult));
  return toStoredRecord({
    envelope,
    storageRef: buildEvidenceStoreStorageRef({
      evidenceStore,
      collection: "ocrResults",
      itemId: ocrResult.id,
    }),
  });
}
