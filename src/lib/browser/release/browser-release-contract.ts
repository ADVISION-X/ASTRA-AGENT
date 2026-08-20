export type BrowserArtifactSetIdentityV1 = Readonly<{
  schemaVersion: "browser-artifact-set.v1";
  artifactSetHash: `sha256:${string}`;
  controllerBundleHash: `sha256:${string}`;
  nativeHostBinaryHash: `sha256:${string}`;
  nativeHostSignatureIdentity: string;
  nativeHostNotarizationRef: string;
  extensionSourceZipHash: `sha256:${string}`;
  extensionVerifiedCrxHash: `sha256:${string}`;
  extensionInstalledTreeDigestRule: string;
  protocolSchemaHash: `sha256:${string}`;
  commandRegistryHash: `sha256:${string}`;
  permissionPolicyHash: `sha256:${string}`;
  originPolicyHash: `sha256:${string}`;
  buildToolchainIdentity: string;
  sbomHash: `sha256:${string}`;
  provenanceHash: `sha256:${string}`;
  vendorSignature: string;
}>;

export type BrowserActivationTupleV1 = Readonly<{
  schemaVersion: "browser-activation-tuple.v1";
  tupleId: string;
  controllerArtifactHash: `sha256:${string}`;
  hostArtifactHash: `sha256:${string}`;
  extensionId: string;
  extensionVersion: string;
  extensionArtifactDigest: `sha256:${string}`;
  protocolRevision: number;
  capabilitySetHash: `sha256:${string}`;
  permissionPolicyHash: `sha256:${string}`;
  profilePolicyHash: `sha256:${string}`;
  authorityLivenessPolicyHash: `sha256:${string}`;
  commandAdmissionBudgetHash: `sha256:${string}`;
  artifactStreamBudgetHash: `sha256:${string}`;
  releaseSecurityPolicyHash: `sha256:${string}`;
  maxAuthorityAgeMs: number;
  chromeChannel: "stable" | "extended_stable";
  chromeVersionRange: string;
  platformAdapterId: string;
  architecture: string;
  validFromRelease: string;
  validUntilRelease: string;
  vendorSignature: string;
}>;

export type BrowserReleaseSecurityPolicyV1 = Readonly<{
  schemaVersion: "browser-release-security-policy.v1";
  releaseSequence: number;
  minimumAcceptedReleaseSequence: number;
  revokedArtifactSetHashes: readonly `sha256:${string}`[];
  revokedActivationTupleIds: readonly string[];
  currentTupleId: string;
  previousTupleId: string | null;
  previousValidUntil: string | null;
  vendorSignature: string;
}>;

export type BrowserReleaseProofManifestV1 = Readonly<{
  schemaVersion: "browser-release-proof.v1";
  agentCandidateCommit: string;
  browserSourceTreeHash: `sha256:${string}`;
  artifactSetHash: `sha256:${string}`;
  activationTupleHash: `sha256:${string}`;
  releaseSecurityPolicyHash: `sha256:${string}`;
  profileEnrollmentPolicyHash: `sha256:${string}`;
  workerMembershipPolicyHash: `sha256:${string}`;
  lawRegistryHash: `sha256:${string}`;
  blueprintHash: `sha256:${string}`;
  auditPlanHash: `sha256:${string}`;
  deterministicAcceptanceHash: `sha256:${string}`;
  packagedChromeProofHash: `sha256:${string}`;
  soakEvidenceHash: `sha256:${string}`;
  xuanxueCrossRepoContractHash: `sha256:${string}`;
  verdict: "BLOCKED" | "PRODUCTION_APPROVED";
  signedAt: string;
  approverSignature: string;
}>;

export type BrowserRollbackReceiptV1 = Readonly<{
  schemaVersion: "browser-rollback-receipt.v1";
  fromReleaseSequence: number;
  toReleaseSequence: number;
  fromTupleId: string;
  toTupleId: string;
  reasonCode: string;
  operatorIdentityHash: `sha256:${string}`;
  releaseIdentityHash: `sha256:${string}`;
  proofHash: `sha256:${string}`;
  vendorSignature: string;
}>;

export type VerifiedBrowserReleaseBinding = Readonly<{
  artifactSet: BrowserArtifactSetIdentityV1;
  activationTuple: BrowserActivationTupleV1;
  securityPolicy: BrowserReleaseSecurityPolicyV1;
  artifactSetHash: `sha256:${string}`;
  activationTupleHash: `sha256:${string}`;
  releaseSecurityPolicyHash: `sha256:${string}`;
}>;

export const assertBrowserReleaseBinding = (
  binding: VerifiedBrowserReleaseBinding,
  now = new Date(),
): void => {
  const policy = binding.securityPolicy;
  const tuple = binding.activationTuple;
  if (policy.releaseSequence < policy.minimumAcceptedReleaseSequence) {
    throw new Error("BROWSER_RELEASE_ROLLBACK_BLOCKED");
  }
  if (policy.revokedArtifactSetHashes.includes(binding.artifactSetHash)) {
    throw new Error("BROWSER_ARTIFACT_REVOKED");
  }
  if (policy.revokedActivationTupleIds.includes(tuple.tupleId)) {
    throw new Error("BROWSER_ACTIVATION_TUPLE_REVOKED");
  }
  const allowed = tuple.tupleId === policy.currentTupleId
    || (tuple.tupleId === policy.previousTupleId
      && policy.previousValidUntil !== null
      && now.getTime() <= Date.parse(policy.previousValidUntil));
  if (!allowed) throw new Error("BROWSER_ACTIVATION_TUPLE_MISMATCH");
  if (tuple.releaseSecurityPolicyHash !== binding.releaseSecurityPolicyHash) {
    throw new Error("BROWSER_ACTIVATION_SECURITY_POLICY_MISMATCH");
  }
  if (tuple.controllerArtifactHash !== binding.artifactSet.controllerBundleHash
    || tuple.hostArtifactHash !== binding.artifactSet.nativeHostBinaryHash
    || tuple.capabilitySetHash !== binding.artifactSet.commandRegistryHash
    || tuple.permissionPolicyHash !== binding.artifactSet.permissionPolicyHash) {
    throw new Error("BROWSER_ACTIVATION_ARTIFACT_MISMATCH");
  }
};
