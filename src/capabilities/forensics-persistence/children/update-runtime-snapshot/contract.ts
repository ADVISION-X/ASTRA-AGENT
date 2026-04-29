export const UPDATE_RUNTIME_SNAPSHOT_CHILD = {
  childCapabilityId: "update-runtime-snapshot",
  recordType: "runtime_snapshot",
  schemaVersion: "forensics.runtime_snapshot.v2",
  allowedPersistenceModes: ["replace-by-session"],
  allowExternalArtifactRef: true,
  onArtifactWriteFailure: "review_required",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
