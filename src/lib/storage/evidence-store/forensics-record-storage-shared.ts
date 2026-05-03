import type { ForensicsArtifactRef, ForensicsRecordEnvelope, ForensicsRecordRef, StoredForensicsRecord } from "./forensics-storage-types.js";

export function buildRecordRef(envelope: ForensicsRecordEnvelope, storageRef: string | null): ForensicsRecordRef {
  return {
    recordType: envelope.recordType,
    recordId: envelope.recordId,
    storageRef,
  };
}

export function toStoredRecord(input: {
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