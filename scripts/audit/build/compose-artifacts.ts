import { existsSync } from "node:fs";

import type {
  AuditConflict,
  AuditPlanEntry,
  EnforcementMatrixRow,
  StaticClauseCoverageEntry,
} from "../shared/generated-contracts.js";
import type { LawSource } from "../shared/law-contracts.js";
import type { ManifestSource } from "../shared/manifest-contracts.js";
import { resolveFromRepo } from "../shared/paths.js";

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

type LawIndexes = {
  lawsById: Map<string, LawSource[]>;
  lawsByDomain: Map<string, LawSource[]>;
  manifestsByDomain: Map<string, ManifestSource[]>;
};

type ResolvedManifestLaws = {
  laws: LawSource[];
  missingLawIds: string[];
};

type ArtifactOutputs = {
  conflicts: AuditConflict[];
  matrixRows: EnforcementMatrixRow[];
  planEntries: AuditPlanEntry[];
  staticCoverage: StaticClauseCoverageEntry[];
};

const indexSources = (
  activeLaws: readonly LawSource[],
  manifests: readonly ManifestSource[],
): LawIndexes => {
  const lawsById = new Map<string, LawSource[]>();
  const lawsByDomain = new Map<string, LawSource[]>();
  const manifestsByDomain = new Map<string, ManifestSource[]>();
  for (const law of activeLaws) {
    lawsById.set(law.lawId, [...(lawsById.get(law.lawId) ?? []), law]);
    lawsByDomain.set(law.capabilityDomain, [...(lawsByDomain.get(law.capabilityDomain) ?? []), law]);
  }
  for (const manifest of manifests) {
    manifestsByDomain.set(manifest.capabilityDomain, [...(manifestsByDomain.get(manifest.capabilityDomain) ?? []), manifest]);
  }
  return {
    lawsById,
    lawsByDomain,
    manifestsByDomain,
  };
};

const pushDuplicates = (
  conflicts: AuditConflict[],
  lawsById: ReadonlyMap<string, readonly LawSource[]>,
): void => {
  for (const [lawId, sources] of lawsById) {
    if (sources.length < 2) {
      continue;
    }
    for (const source of sources) {
      conflicts.push({
        kind: "duplicate-law-id",
        lawId,
        filePath: source.filePath,
        capabilityDomain: source.capabilityDomain,
        message: `Duplicate active lawId ${lawId} detected in ${source.filePath}.`,
      });
    }
  }
};

const pushDuplicateManifestConflicts = (
  conflicts: AuditConflict[],
  manifestsByDomain: ReadonlyMap<string, readonly ManifestSource[]>,
): void => {
  for (const [capabilityDomain, sources] of manifestsByDomain) {
    if (sources.length < 2) {
      continue;
    }
    for (const source of sources) {
      conflicts.push({
        kind: "duplicate-manifest-domain",
        capabilityDomain,
        filePath: source.manifestPath,
        message: `Duplicate manifest for capabilityDomain ${capabilityDomain}.`,
      });
    }
  }
};

const pushMissingManifestConflicts = (
  conflicts: AuditConflict[],
  capabilityDomain: string,
  domainLaws: readonly LawSource[],
): void => {
  for (const law of domainLaws) {
    conflicts.push({
      kind: "missing-manifest",
      lawId: law.lawId,
      capabilityDomain,
      filePath: law.filePath,
      message: `No manifest found for capabilityDomain ${capabilityDomain}.`,
    });
  }
};

const pushMissingInspectorConflict = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
  capabilityDomain: string,
): void => {
  if (existsSync(resolveFromRepo(manifest.ownerInspectorPath))) {
    return;
  }
  conflicts.push({
    kind: "missing-inspector-entry",
    capabilityDomain,
    filePath: manifest.manifestPath,
    message: `Owner inspector entry ${manifest.ownerInspectorPath} does not exist.`,
  });
};

const appendStaticCoverage = (
  staticCoverage: StaticClauseCoverageEntry[],
  capabilityDomain: string,
  domainLaws: readonly LawSource[],
  manifest: ManifestSource,
): void => {
  for (const law of domainLaws) {
    staticCoverage.push({
      lawId: law.lawId,
      capabilityDomain,
      clauses: manifest.coverage.clauseIds.map((clauseId) => ({
        clauseId,
        source: manifest.manifestPath,
      })),
    });
  }
};

const appendDomainArtifacts = (
  outputs: ArtifactOutputs,
  capabilityDomain: string,
  domainLaws: readonly LawSource[],
  manifest: ManifestSource,
): void => {
  const lawIds = uniqueSorted(domainLaws.map((law) => law.lawId));
  pushMissingInspectorConflict(outputs.conflicts, manifest, capabilityDomain);
  outputs.matrixRows.push({
    capabilityDomain,
    manifestPath: manifest.manifestPath,
    ownerInspectorPath: manifest.ownerInspectorPath,
    lawIds,
  });
  outputs.planEntries.push({
    capabilityDomain,
    manifestPath: manifest.manifestPath,
    ownerInspectorPath: manifest.ownerInspectorPath,
    executionGroup: manifest.executionGroup,
    lawIds,
    clauseIds: manifest.coverage.clauseIds,
    evidenceModes: uniqueSorted(domainLaws.map((law) => law.evidenceMode)),
    blueprintRefs: manifest.blueprintRefs ?? [],
  });
  appendStaticCoverage(outputs.staticCoverage, capabilityDomain, domainLaws, manifest);
};

const resolveManifestLaws = (
  manifest: ManifestSource,
  indexes: LawIndexes,
): ResolvedManifestLaws => {
  const resolved = new Map<string, LawSource>();
  const missingLawIds: string[] = [];

  for (const law of indexes.lawsByDomain.get(manifest.capabilityDomain) ?? []) {
    resolved.set(law.lawId, law);
  }

  for (const lawId of manifest.lawIdRefs ?? []) {
    const matchedLaw = indexes.lawsById.get(lawId)?.[0];
    if (!matchedLaw) {
      missingLawIds.push(lawId);
      continue;
    }
    resolved.set(matchedLaw.lawId, matchedLaw);
  }

  return {
    laws: [...resolved.values()],
    missingLawIds,
  };
};

const appendManifestLawRefConflicts = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
  missingLawIds: readonly string[],
): void => {
  for (const lawId of missingLawIds) {
    conflicts.push({
      kind: "unknown-law-reference",
      capabilityDomain: manifest.capabilityDomain,
      filePath: manifest.manifestPath,
      lawId,
      message: `Manifest ${manifest.manifestPath} references unknown lawId ${lawId}.`,
    });
  }
};

const appendDomainArtifactsFromIndexes = (
  outputs: ArtifactOutputs,
  indexes: LawIndexes,
): void => {
  for (const [capabilityDomain, domainLaws] of indexes.lawsByDomain) {
    const manifest = indexes.manifestsByDomain.get(capabilityDomain)?.[0];
    if (!manifest) {
      pushMissingManifestConflicts(outputs.conflicts, capabilityDomain, domainLaws);
    }
  }

  for (const [capabilityDomain, manifests] of indexes.manifestsByDomain) {
    const manifest = manifests[0];
    if (!manifest) {
      continue;
    }
    const resolved = resolveManifestLaws(manifest, indexes);
    appendManifestLawRefConflicts(outputs.conflicts, manifest, resolved.missingLawIds);
    if (resolved.laws.length === 0) {
      continue;
    }
    appendDomainArtifacts(outputs, capabilityDomain, resolved.laws, manifest);
  }
};

const pushUncoveredLawConflicts = (
  conflicts: AuditConflict[],
  activeLaws: readonly LawSource[],
  staticCoverage: readonly StaticClauseCoverageEntry[],
): void => {
  for (const law of activeLaws) {
    if (staticCoverage.some((entry) => entry.lawId === law.lawId)) {
      continue;
    }
    conflicts.push({
      kind: "uncovered-law",
      capabilityDomain: law.capabilityDomain,
      filePath: law.filePath,
      lawId: law.lawId,
      message: `Active law ${law.lawId} has no generated static clause coverage.`,
    });
  }
};

export const composeArtifacts = (
  laws: readonly LawSource[],
  manifests: readonly ManifestSource[],
): {
  conflicts: AuditConflict[];
  matrixRows: EnforcementMatrixRow[];
  planEntries: AuditPlanEntry[];
  staticCoverage: StaticClauseCoverageEntry[];
} => {
  const activeLaws = laws.filter((law) => law.status === "active");
  const outputs: ArtifactOutputs = {
    conflicts: [],
    matrixRows: [],
    planEntries: [],
    staticCoverage: [],
  };
  const indexes = indexSources(activeLaws, manifests);
  pushDuplicates(outputs.conflicts, indexes.lawsById);
  pushDuplicateManifestConflicts(outputs.conflicts, indexes.manifestsByDomain);
  appendDomainArtifactsFromIndexes(outputs, indexes);
  pushUncoveredLawConflicts(outputs.conflicts, activeLaws, outputs.staticCoverage);
  return outputs;
};