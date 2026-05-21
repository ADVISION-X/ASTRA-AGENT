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

export const composeArtifacts = (
  laws: readonly LawSource[],
  manifests: readonly ManifestSource[],
): {
  conflicts: AuditConflict[];
  matrixRows: EnforcementMatrixRow[];
  planEntries: AuditPlanEntry[];
  staticCoverage: StaticClauseCoverageEntry[];
} => {
  const conflicts: AuditConflict[] = [];
  const activeLaws = laws.filter((law) => law.status === "active");
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

  pushDuplicates(conflicts, lawsById);
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

  const matrixRows: EnforcementMatrixRow[] = [];
  const planEntries: AuditPlanEntry[] = [];
  const staticCoverage: StaticClauseCoverageEntry[] = [];

  for (const [capabilityDomain, domainLaws] of lawsByDomain) {
    const manifest = manifestsByDomain.get(capabilityDomain)?.[0];
    const lawIds = uniqueSorted(domainLaws.map((law) => law.lawId));
    if (!manifest) {
      for (const law of domainLaws) {
        conflicts.push({
          kind: "missing-manifest",
          lawId: law.lawId,
          capabilityDomain,
          filePath: law.filePath,
          message: `No manifest found for capabilityDomain ${capabilityDomain}.`,
        });
      }
      continue;
    }

    if (!existsSync(resolveFromRepo(manifest.ownerInspectorPath))) {
      conflicts.push({
        kind: "missing-inspector-entry",
        capabilityDomain,
        filePath: manifest.manifestPath,
        message: `Owner inspector entry ${manifest.ownerInspectorPath} does not exist.`,
      });
    }

    matrixRows.push({
      capabilityDomain,
      manifestPath: manifest.manifestPath,
      ownerInspectorPath: manifest.ownerInspectorPath,
      lawIds,
    });
    planEntries.push({
      capabilityDomain,
      manifestPath: manifest.manifestPath,
      ownerInspectorPath: manifest.ownerInspectorPath,
      executionGroup: manifest.executionGroup,
      lawIds,
      clauseIds: manifest.coverage.clauseIds,
      evidenceModes: uniqueSorted(domainLaws.map((law) => law.evidenceMode)),
      blueprintRefs: manifest.blueprintRefs ?? [],
    });
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
  }

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

  return {
    conflicts,
    matrixRows,
    planEntries,
    staticCoverage,
  };
};