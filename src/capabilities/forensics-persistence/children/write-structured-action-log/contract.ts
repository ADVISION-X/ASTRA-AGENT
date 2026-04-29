export const WRITE_STRUCTURED_ACTION_LOG_CHILD = {
  childCapabilityId: "write-structured-action-log",
  recordType: "structured_action_log",
  schemaVersion: "forensics.structured_action_log.v2",
  allowedPersistenceModes: ["append"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "failed",
  requireSourceRecordRefs: false,
  requireParentRefs: true,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
