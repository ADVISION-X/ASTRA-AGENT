import type { ForensicsRecordEnvelope, ForensicsRecordQuery, ForensicsRecordRef, StoredForensicsRecord } from "../schema.js";

export interface ForensicsStoragePort {
  appendRecord(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  replaceRecordByRound(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  replaceRecordBySession(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  updateRuntimeSnapshot(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  readRecord(ref: ForensicsRecordRef): Promise<StoredForensicsRecord | null>;
  listRecords(query: ForensicsRecordQuery): Promise<StoredForensicsRecord[]>;
}
