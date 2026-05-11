/**
 * Storage-layer port interfaces for legacy evidence-store record/artifact storage.
 * Defined locally — does NOT import from the forensics-persistence capability.
 */
import type {
  ForensicsArtifactRef,
  ForensicsRecordEnvelope,
  ForensicsRecordQuery,
  ForensicsRecordRef,
  StoredForensicsRecord,
} from "./forensics-storage-schema-types.js";

export type ForensicsWriteRecordInput = {
  envelope: ForensicsRecordEnvelope;
  operation: "append-record" | "replace-record-by-round" | "replace-record-by-session";
};

export interface ForensicsStoragePort {
  writeRecord(input: ForensicsWriteRecordInput): Promise<StoredForensicsRecord>;
  updateRuntimeSnapshot(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  readRecord(ref: ForensicsRecordRef): Promise<StoredForensicsRecord | null>;
  listRecords(query: ForensicsRecordQuery): Promise<StoredForensicsRecord[]>;
}

export interface ForensicsArtifactStoragePort {
  writeArtifactRef(input: ForensicsArtifactRef): Promise<ForensicsArtifactRef>;
}
