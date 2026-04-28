import type { ForensicsArtifactRef } from "./shared/artifact-ref.js";
import type { ForensicsRecordEnvelope, ForensicsRecordType } from "./shared/record-envelope.js";
import type { ForensicsRecordRef } from "./shared/record-ref.js";

export type StoredForensicsRecord = {
  recordRef: ForensicsRecordRef;
  storageRef: string | null;
  envelope: ForensicsRecordEnvelope;
  artifactRefs: ForensicsArtifactRef[];
  persistedAt: string;
};

export type ForensicsRecordQuery = {
  recordType?: ForensicsRecordType;
  sessionId?: string;
  roundId?: string;
  videoVisitId?: string | null;
  limit?: number;
};

export interface ForensicsStoragePort {
  writeRecord(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
  readRecord(ref: ForensicsRecordRef): Promise<StoredForensicsRecord | null>;
  listRecords(query: ForensicsRecordQuery): Promise<StoredForensicsRecord[]>;
  writeArtifactRef(artifact: ForensicsArtifactRef): Promise<ForensicsArtifactRef>;
  updateRuntimeSnapshot(envelope: ForensicsRecordEnvelope): Promise<StoredForensicsRecord>;
}