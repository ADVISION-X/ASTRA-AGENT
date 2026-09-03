export type EvidenceHash = `sha256:${string}`;

export type ExecutionEvidenceReference = Readonly<{
  evidenceRef: string;
  evidenceHash: EvidenceHash;
}>;

export type ArtifactCheckpointReceipt = Readonly<{
  artifactRef: string;
  rawDomHash: EvidenceHash;
  semanticTextHash: EvidenceHash;
}>;
