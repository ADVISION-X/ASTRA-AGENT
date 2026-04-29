export const FINALIZE_BROWSE_LEDGER_CHILD = {
  childCapabilityId: "finalize-browse-ledger",
  recordType: "browse_ledger_entry",
  schemaVersion: "forensics.browse_ledger_entry.v2",
  allowedPersistenceModes: ["replace-by-round"],
  allowExternalArtifactRef: true,
  onArtifactWriteFailure: "review_required",
  requireSourceRecordRefs: false,
  requireParentRefs: true,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
