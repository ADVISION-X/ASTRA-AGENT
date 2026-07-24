import type {
  AuditConflict,
  AuditPlanEntry,
  EnforcementMatrixRow,
  StaticClauseCoverageEntry,
} from "../shared/generated-contracts.js";
import { appendDomainArtifactsFromIndexes } from "./compose-artifact-domain-artifacts.js";
import type { LawSource } from "../shared/law-contracts.js";
import type { ManifestSource } from "../shared/manifest-contracts.js";
import { createAuditProject } from "../shared/project.js";

type LawIndexes = {
  lawsById: Map<string, LawSource[]>;
  manifestsByDomain: Map<string, ManifestSource[]>;
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
  const manifestsByDomain = new Map<string, ManifestSource[]>();
  for (const law of activeLaws) {
    lawsById.set(law.lawId, [...(lawsById.get(law.lawId) ?? []), law]);
  }
  for (const manifest of manifests) {
    manifestsByDomain.set(manifest.capabilityDomain, [...(manifestsByDomain.get(manifest.capabilityDomain) ?? []), manifest]);
  }
  return {
    lawsById,
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
  appendDomainArtifactsFromIndexes(outputs, indexes, createAuditProject(), activeLaws);
  return outputs;
};
