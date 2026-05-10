export const WRITE_PRODUCT_LEAD_RECORD_CHILD = {
  childCapabilityId: "write-product-lead-record",
  recordType: "product_lead_record",
  schemaVersion: "forensics.product_lead_record.v1",
  allowedPersistenceModes: ["append"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "review_required",
  requireSourceRecordRefs: false,
  requireParentRefs: false,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;