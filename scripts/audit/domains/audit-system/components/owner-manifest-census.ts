import { existsSync } from "node:fs";

import { loadOwnerManifests, listOwnerManifestPaths, toManifestRelativePath } from "../../../core/owner-manifests.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding, LawRecord, OwnerManifest } from "../../../core/schema.js";

export type OwnerManifestCensusResult = {
  manifests: OwnerManifest[];
  findings: Finding[];
  manifestPaths: string[];
};

const manifestFinding = (
  lawId: string,
  file: string,
  message: string,
  hint: string,
): Finding => createFinding({ lawId, file, line: 1, severity: "fatal", message, hint });

const buildLawMaps = (laws: LawRecord[]) => {
  const lawIdsByDomain = new Map<string, string[]>();
  const lawDomainById = new Map<string, string>();
  for (const law of laws) {
    const current = lawIdsByDomain.get(law.capabilityDomain) ?? [];
    current.push(law.lawId);
    lawIdsByDomain.set(law.capabilityDomain, current);
    lawDomainById.set(law.lawId, law.capabilityDomain);
  }
  return { lawIdsByDomain, lawDomainById };
};

const groupManifestsByDomain = (manifests: OwnerManifest[]): Map<string, OwnerManifest[]> => {
  const manifestsByDomain = new Map<string, OwnerManifest[]>();
  for (const manifest of manifests) {
    const current = manifestsByDomain.get(manifest.capabilityDomain) ?? [];
    current.push(manifest);
    manifestsByDomain.set(manifest.capabilityDomain, current);
  }
  return manifestsByDomain;
};

const collectDomainCoverageFindings = (
  lawIdsByDomain: Map<string, string[]>,
  manifestsByDomain: Map<string, OwnerManifest[]>,
): Finding[] => {
  const findings: Finding[] = [];
  for (const [capabilityDomain, lawIds] of lawIdsByDomain.entries()) {
    const matchingManifests = manifestsByDomain.get(capabilityDomain) ?? [];
    const primaryLawId = lawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1";
    if (matchingManifests.length === 0) {
      findings.push(manifestFinding(primaryLawId, `scripts/audit/domains/${capabilityDomain}/manifest.json`, "active capabilityDomain has no owner manifest", "Add one owner manifest for this capability domain."));
      continue;
    }
    if (matchingManifests.length > 1) {
      findings.push(manifestFinding(primaryLawId, `scripts/audit/domains/${capabilityDomain}/manifest.json`, "capabilityDomain has multiple owner manifests", "Keep exactly one owner manifest per active capability domain."));
    }
  }
  return findings;
};

const collectManifestFieldFindings = (
  manifest: OwnerManifest,
  manifestPath: string,
  primaryLawId: string,
): Finding[] => {
  const findings: Finding[] = [];
  if (!manifest.inspectorId) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest is missing inspectorId", "Bind the owner manifest to one inspectorId."));
  if (!manifest.entry) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest is missing entry", "Point the owner manifest to one inspector entry file."));
  if (!manifest.runner) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest is missing runner", "Point the owner manifest to one runner entry."));
  if (!manifest.exportName) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest is missing exportName", "Declare which exported inspector function is authoritative."));
  if (manifest.entry && !existsSync(pathFromRepoRoot(manifest.entry))) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest entry file does not exist", "Create the declared inspector entry file or fix the entry path."));
  if (manifest.runner && !existsSync(pathFromRepoRoot(manifest.runner))) findings.push(manifestFinding(primaryLawId, manifestPath, "manifest runner file does not exist", "Create the declared runner entry file or fix the runner path."));
  return findings;
};

const collectManifestLawScopeFindings = (
  manifest: OwnerManifest,
  manifestPath: string,
  domainLawIds: string[],
  lawDomainById: Map<string, string>,
): Finding[] => {
  const findings: Finding[] = [];
  const missingLawIds = domainLawIds.filter((lawId) => !manifest.allowedLawIds.includes(lawId));
  for (const lawId of missingLawIds) {
    findings.push(manifestFinding(lawId, manifestPath, "manifest allowedLawIds is missing an active lawId", "Add the active lawId to allowedLawIds."));
  }
  const foreignLawIds = manifest.allowedLawIds.filter((lawId) => lawDomainById.get(lawId) !== undefined && lawDomainById.get(lawId) !== manifest.capabilityDomain);
  for (const lawId of foreignLawIds) {
    findings.push(manifestFinding(lawId, manifestPath, "manifest allowedLawIds includes a foreign-domain lawId", "Keep allowedLawIds scoped to the manifest capabilityDomain only."));
  }
  return findings;
};

export const runOwnerManifestCensus = (laws: LawRecord[]): OwnerManifestCensusResult => {
  const manifests = loadOwnerManifests();
  const manifestPaths = listOwnerManifestPaths();
  const { lawIdsByDomain, lawDomainById } = buildLawMaps(laws);
  const manifestsByDomain = groupManifestsByDomain(manifests);
  const findings = collectDomainCoverageFindings(lawIdsByDomain, manifestsByDomain);

  for (const [index, manifest] of manifests.entries()) {
    const manifestPathSource = manifestPaths[index];
    if (!manifestPathSource) continue;
    const manifestPath = toManifestRelativePath(manifestPathSource);
    const domainLawIds = lawIdsByDomain.get(manifest.capabilityDomain) ?? [];
    const primaryLawId = domainLawIds[0] ?? "GRASSEYE-AUDIT-SYSTEM-001-V1";
    findings.push(...collectManifestFieldFindings(manifest, manifestPath, primaryLawId));
    findings.push(...collectManifestLawScopeFindings(manifest, manifestPath, domainLawIds, lawDomainById));
  }

  return { manifests, findings, manifestPaths: manifestPaths.map((path) => toManifestRelativePath(path)) };
};