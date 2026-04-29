export const WRITE_STRUCTURED_RUNTIME_EVENT_CHILD = {
  childCapabilityId: "write-structured-runtime-event",
  recordType: "structured_runtime_event",
  schemaVersion: "forensics.structured_runtime_event.v2",
  allowedPersistenceModes: ["append"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "failed",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
