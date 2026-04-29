export const FINALIZE_FAILED_RECORD_CHILD = {
  childCapabilityId: "finalize-failed-record",
  recordType: "failed_record",
  schemaVersion: "forensics.failed_record.v2",
  allowedPersistenceModes: ["replace-by-round"],
  allowExternalArtifactRef: true,
  onArtifactWriteFailure: "review_required",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
