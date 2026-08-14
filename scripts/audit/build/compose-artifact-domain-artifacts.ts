import { existsSync, readFileSync } from "node:fs";

import type { Project } from "ts-morph";

import type {
  AuditConflict,
  AuditPlanEntry,
  EnforcementMatrixRow,
  StaticClauseCoverageEntry,
} from "../shared/generated-contracts.js";
import type { LawSource } from "../shared/law-contracts.js";
import type { ManifestSource } from "../shared/manifest-contracts.js";
import { extractMarkdownHeadings, normalizeMarkdownHeading } from "../shared/no-regex.js";
import { resolveFromRepo } from "../shared/paths.js";
import { ownerAssertionRoots, sourceEvidenceIsReachable } from "./source-evidence-reachability.js";

const uniqueSorted = (values: readonly string[]): string[] => [...new Set(values)].sort();
const clauseKey = (lawId: string, clauseId: string): string => `${lawId}::${clauseId}`;

type DomainIndexes = {
  lawsById: ReadonlyMap<string, readonly LawSource[]>;
  manifestsByDomain: ReadonlyMap<string, readonly ManifestSource[]>;
};

type ArtifactOutputs = {
  conflicts: AuditConflict[];
  matrixRows: EnforcementMatrixRow[];
  planEntries: AuditPlanEntry[];
  staticCoverage: StaticClauseCoverageEntry[];
};

const pushMissingInspectorConflict = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
): void => {
  if (existsSync(resolveFromRepo(manifest.ownerInspectorPath))) {
    return;
  }
  conflicts.push({
    kind: "missing-inspector-entry",
    capabilityDomain: manifest.capabilityDomain,
    filePath: manifest.manifestPath,
    message: `Owner inspector entry ${manifest.ownerInspectorPath} does not exist.`,
  });
};

export const validateBlueprintClosure = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
): void => {
  for (const blueprintRef of manifest.blueprintRefs ?? []) {
    const absolutePath = resolveFromRepo(blueprintRef.filePath);
    if (!existsSync(absolutePath)) {
      conflicts.push({
        kind: "missing-blueprint-anchor",
        capabilityDomain: manifest.capabilityDomain,
        filePath: blueprintRef.filePath,
        message: `Blueprint ${blueprintRef.filePath} does not exist.`,
      });
      continue;
    }
    const headings = extractMarkdownHeadings(readFileSync(absolutePath, "utf8"));
    for (const anchor of blueprintRef.requiredAnchors) {
      if (headings.has(normalizeMarkdownHeading(anchor))) continue;
      conflicts.push({
        kind: "missing-blueprint-anchor",
        capabilityDomain: manifest.capabilityDomain,
        filePath: blueprintRef.filePath,
        message: `Blueprint ${blueprintRef.filePath} is missing required anchor ${anchor}.`,
      });
    }
  }
};

const validateSourceEvidence = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
  project: Project,
): void => {
  for (const binding of manifest.coverage.bindings) {
    for (const evidence of binding.sourceEvidence) {
      const sourceFile = project.getSourceFile(resolveFromRepo(evidence.filePath));
      if (!sourceFile) {
        conflicts.push({
          kind: "missing-source-evidence",
          capabilityDomain: manifest.capabilityDomain,
          filePath: evidence.filePath,
          lawId: binding.lawId,
          message: `Clause ${binding.lawId}/${binding.clauseId} source evidence file does not exist in the audit project.`,
        });
        continue;
      }
      if (!sourceFile.getExportedDeclarations().has(evidence.symbolName)) {
        conflicts.push({
          kind: "missing-source-symbol",
          capabilityDomain: manifest.capabilityDomain,
          filePath: evidence.filePath,
          lawId: binding.lawId,
          message: `Clause ${binding.lawId}/${binding.clauseId} source evidence symbol ${evidence.symbolName} is not exported.`,
        });
        continue;
      }
      if (sourceEvidenceIsReachable(project, manifest, evidence.filePath, evidence.symbolName)) continue;
      conflicts.push({
        kind: "unreachable-source-evidence",
        capabilityDomain: manifest.capabilityDomain,
        filePath: evidence.filePath,
        lawId: binding.lawId,
        message: `Clause ${binding.lawId}/${binding.clauseId} source evidence symbol ${evidence.symbolName} is not reachable from the owning inspector assertion set.`,
      });
    }
  }
};

const validateCheckEvidence = (
  conflicts: AuditConflict[],
  manifest: ManifestSource,
  project: Project,
): void => {
  const expectedCheckId = `${manifest.capabilityDomain}/owner-assertion-set`;
  const declaredCheckIds = uniqueSorted(manifest.coverage.bindings.flatMap((binding) => binding.checkIds));
  if (declaredCheckIds.length === 1 && declaredCheckIds[0] === expectedCheckId
    && ownerAssertionRoots(project, manifest).length === 2) return;
  conflicts.push({
    kind: "missing-check-evidence",
    capabilityDomain: manifest.capabilityDomain,
    filePath: manifest.manifestPath,
    message: `${manifest.capabilityDomain} must bind exactly one ${expectedCheckId} physical check and execute it through context.checks.runAll().`,
  });
};

const resolveOwnedClause = (
  outputs: ArtifactOutputs,
  manifest: ManifestSource,
  indexes: DomainIndexes,
  binding: ManifestSource["coverage"]["bindings"][number],
): LawSource["clauses"][number] | null => {
  const law = indexes.lawsById.get(binding.lawId)?.[0];
  if (!law) {
    outputs.conflicts.push({
      kind: "unknown-law-reference",
      capabilityDomain: manifest.capabilityDomain,
      filePath: manifest.manifestPath,
      lawId: binding.lawId,
      message: `Manifest ${manifest.manifestPath} references unknown active law ${binding.lawId}.`,
    });
    return null;
  }
  const clause = law.clauses.find((candidate) => candidate.clauseId === binding.clauseId);
  if (!clause) {
    outputs.conflicts.push({
      kind: "unknown-clause-reference",
      capabilityDomain: manifest.capabilityDomain,
      filePath: manifest.manifestPath,
      lawId: binding.lawId,
      message: `Manifest ${manifest.manifestPath} references unknown clause ${binding.lawId}/${binding.clauseId}.`,
    });
    return null;
  }
  if (clause.ownerDomain === manifest.capabilityDomain) return clause;
  outputs.conflicts.push({
    kind: "wrong-clause-owner",
    capabilityDomain: manifest.capabilityDomain,
    filePath: manifest.manifestPath,
    lawId: binding.lawId,
    message: `Clause ${binding.lawId}/${binding.clauseId} belongs to ${clause.ownerDomain}, not ${manifest.capabilityDomain}.`,
  });
  return null;
};

const claimClauseBinding = (
  outputs: ArtifactOutputs,
  manifest: ManifestSource,
  binding: ManifestSource["coverage"]["bindings"][number],
  boundClauseKeys: Map<string, string>,
): boolean => {
  const key = clauseKey(binding.lawId, binding.clauseId);
  const existingManifest = boundClauseKeys.get(key);
  if (!existingManifest) {
    boundClauseKeys.set(key, manifest.manifestPath);
    return true;
  }
  outputs.conflicts.push({
    kind: "duplicate-clause-binding",
    capabilityDomain: manifest.capabilityDomain,
    filePath: manifest.manifestPath,
    lawId: binding.lawId,
    message: `Clause ${binding.lawId}/${binding.clauseId} is already bound by ${existingManifest}.`,
  });
  return false;
};

const primaryEvidenceIsValid = (
  outputs: ArtifactOutputs,
  manifest: ManifestSource,
  law: LawSource,
  binding: ManifestSource["coverage"]["bindings"][number],
): boolean => {
  if (law.evidenceMode !== "hybrid") return true;
  const primaryEvidence = binding.primaryEvidence;
  if (!primaryEvidence) {
    outputs.conflicts.push({
      kind: "missing-primary-evidence",
      capabilityDomain: manifest.capabilityDomain,
      filePath: manifest.manifestPath,
      lawId: binding.lawId,
      message: `Hybrid clause ${binding.lawId}/${binding.clauseId} must declare one primary evidence engine and sourceEvidence index.`,
    });
    return false;
  }
  if (binding.sourceEvidence[primaryEvidence.sourceEvidenceIndex]) return true;
  outputs.conflicts.push({
    kind: "invalid-primary-evidence",
    capabilityDomain: manifest.capabilityDomain,
    filePath: manifest.manifestPath,
    lawId: binding.lawId,
    message: `Hybrid clause ${binding.lawId}/${binding.clauseId} primary sourceEvidence index ${primaryEvidence.sourceEvidenceIndex} does not exist.`,
  });
  return false;
};

const appendManifestArtifacts = (
  outputs: ArtifactOutputs,
  manifest: ManifestSource,
  indexes: DomainIndexes,
  boundClauseKeys: Map<string, string>,
): void => {
  const generatedBindings: AuditPlanEntry["bindings"] = [];
  for (const binding of manifest.coverage.bindings) {
    const law = indexes.lawsById.get(binding.lawId)?.[0];
    const clause = resolveOwnedClause(outputs, manifest, indexes, binding);
    if (!law || !clause || !primaryEvidenceIsValid(outputs, manifest, law, binding)
      || !claimClauseBinding(outputs, manifest, binding, boundClauseKeys)) continue;
    generatedBindings.push({
      ...binding,
      evidenceMode: clause.evidenceMode,
    });
    outputs.staticCoverage.push({
      lawId: binding.lawId,
      clauseId: binding.clauseId,
      capabilityDomain: manifest.capabilityDomain,
      evidenceMode: clause.evidenceMode,
      ownerInspectorPath: manifest.ownerInspectorPath,
      checkIds: binding.checkIds,
      sourceEvidence: binding.sourceEvidence,
      ...(binding.primaryEvidence ? { primaryEvidence: binding.primaryEvidence } : {}),
      manifestPath: manifest.manifestPath,
    });
  }

  if (generatedBindings.length === 0) {
    return;
  }
  const lawIds = uniqueSorted(generatedBindings.map((binding) => binding.lawId));
  outputs.matrixRows.push({
    capabilityDomain: manifest.capabilityDomain,
    manifestPath: manifest.manifestPath,
    ownerInspectorPath: manifest.ownerInspectorPath,
    lawIds,
  });
  outputs.planEntries.push({
    capabilityDomain: manifest.capabilityDomain,
    manifestPath: manifest.manifestPath,
    ownerInspectorPath: manifest.ownerInspectorPath,
    executionGroup: manifest.executionGroup,
    lawIds,
    bindings: generatedBindings,
    blueprintRefs: manifest.blueprintRefs ?? [],
  });
};

export const appendDomainArtifactsFromIndexes = (
  outputs: ArtifactOutputs,
  indexes: DomainIndexes,
  project: Project,
  activeLaws: readonly LawSource[],
): void => {
  const boundClauseKeys = new Map<string, string>();
  for (const manifests of indexes.manifestsByDomain.values()) {
    const manifest = manifests[0];
    if (!manifest) {
      continue;
    }
    pushMissingInspectorConflict(outputs.conflicts, manifest);
    validateBlueprintClosure(outputs.conflicts, manifest);
    validateSourceEvidence(outputs.conflicts, manifest, project);
    validateCheckEvidence(outputs.conflicts, manifest, project);
    appendManifestArtifacts(outputs, manifest, indexes, boundClauseKeys);
  }

  for (const law of activeLaws) {
    for (const clause of law.clauses) {
      if (boundClauseKeys.has(clauseKey(law.lawId, clause.clauseId))) {
        continue;
      }
      outputs.conflicts.push({
        kind: "missing-clause-binding",
        capabilityDomain: clause.ownerDomain,
        filePath: law.filePath,
        lawId: law.lawId,
        message: `Active clause ${law.lawId}/${clause.clauseId} has no explicit manifest binding.`,
      });
    }
  }
};
