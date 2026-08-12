import { existsSync } from "node:fs";

import { Node, SyntaxKind, type Project } from "ts-morph";

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
      }
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
  const inspector = project.getSourceFile(resolveFromRepo(manifest.ownerInspectorPath));
  const inspectDomain = inspector?.getFunction("inspectDomain")
    ?? inspector?.getVariableDeclaration("inspectDomain")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const contextParameter = inspectDomain?.getParameters()[0];
  const signedOwnerEvaluations = contextParameter ? inspectDomain?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "runAll") return false;
    const checks = callee.getExpression();
    const receiver = Node.isPropertyAccessExpression(checks) && checks.getName() === "checks"
      ? checks.getExpression()
      : undefined;
    return (receiver?.getSymbol()?.getDeclarations().includes(contextParameter) ?? false)
      && call.getFirstAncestor(Node.isFunctionLikeDeclaration) === inspectDomain
      && Node.isAwaitExpression(call.getParent());
  }) ?? [] : [];
  if (declaredCheckIds.length === 1 && declaredCheckIds[0] === expectedCheckId
    && signedOwnerEvaluations.length === 1) return;
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

const appendManifestArtifacts = (
  outputs: ArtifactOutputs,
  manifest: ManifestSource,
  indexes: DomainIndexes,
  boundClauseKeys: Map<string, string>,
): void => {
  const generatedBindings: AuditPlanEntry["bindings"] = [];
  for (const binding of manifest.coverage.bindings) {
    const clause = resolveOwnedClause(outputs, manifest, indexes, binding);
    if (!clause || !claimClauseBinding(outputs, manifest, binding, boundClauseKeys)) continue;
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
