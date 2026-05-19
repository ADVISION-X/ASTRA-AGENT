import type { MatrixBuildInput } from "./all-law-enforcement-types.js";

export const buildDomainFailureSets = (input: MatrixBuildInput) => ({
  qualityFailingDomains: new Set(
    input.inspectorQualityFindings.flatMap((item) => input.manifests
      .filter((manifest) => manifest.allowedLawIds.includes(item.lawId))
      .map((manifest) => manifest.capabilityDomain)),
  ),
  antiEscapeFailingDomains: new Set(
    input.antiEscapeFindings.flatMap((item) => input.manifests
      .filter((manifest) => (manifest.ownedRoots ?? []).some((root) => item.file.startsWith(root)))
      .map((manifest) => manifest.capabilityDomain)),
  ),
});

export const buildAuditSystemVerdict = (input: MatrixBuildInput) => {
  const failureReason = input.lawCensusFindings[0]?.message
    ?? input.manifestFindings[0]?.message
    ?? input.ciFullFindings[0]?.message
    ?? input.inspectorQualityFindings[0]?.message
    ?? input.antiEscapeFindings[0]?.message;
  return {
    status: failureReason ? "FAIL" as const : "PASS" as const,
    evidence: "audit-system foundation chain covers law census, manifest coverage, CI-FULL coverage, inspector quality, and anti-escape.",
    ...(failureReason ? { failureReason } : {}),
  };
};
