export const WRITE_EVIDENCE_RECORD_CHILD = {
  childCapabilityId: "write-evidence-record",
  recordType: "evidence_record",
  schemaVersion: "forensics.evidence_record.v2",
  allowedPersistenceModes: ["append"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "review_required",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
