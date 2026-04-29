export const WRITE_AI_RESULT_RECORD_CHILD = {
  childCapabilityId: "write-ai-result-record",
  recordType: "ai_result_record",
  schemaVersion: "forensics.ai_result_record.v2",
  allowedPersistenceModes: ["append"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "failed",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
