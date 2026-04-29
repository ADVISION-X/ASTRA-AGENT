export const FINALIZE_EVIDENCE_PACKET_CHILD = {
  childCapabilityId: "finalize-evidence-packet",
  recordType: "evidence_packet",
  schemaVersion: "forensics.evidence_packet.v2",
  allowedPersistenceModes: ["replace-by-round"],
  allowExternalArtifactRef: false,
  onArtifactWriteFailure: "failed",
  requireSourceRecordRefs: true,
  requireParentRefs: true,
  requireArtifactRefs: false,
  requireStorageRef: false,
} as const;
