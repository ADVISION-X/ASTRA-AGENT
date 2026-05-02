import type {
  ForensicsRecordEnvelope,
  ForensicsRecordQuery,
  ForensicsRecordRef,
  ForensicsStorageOperation,
  StoredForensicsRecord,
} from "../schema.js";

export type ForensicsWriteRecordInput = {
  envelope: ForensicsRecordEnvelope;
  operation: Exclude<ForensicsStorageOperation, "update-runtime-snapshot">;
};

export interface ForensicsStoragePort {
  writeRecord(input: ForensicsWriteRecordInput): Promise<StoredForensicsRecord>;
  updateRuntimeSnapshot(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  readRecord(ref: ForensicsRecordRef): Promise<StoredForensicsRecord | null>;
  listRecords(query: ForensicsRecordQuery): Promise<StoredForensicsRecord[]>;
}
