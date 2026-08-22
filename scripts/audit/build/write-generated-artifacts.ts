import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  AuditConflict,
  AuditPlanEntry,
  EnforcementMatrixRow,
  StaticClauseCoverageEntry,
} from "../shared/generated-contracts.js";
import type { LawSource } from "../shared/law-contracts.js";
import { generatedDir } from "../shared/paths.js";
import {
  evidenceModeIncludesRealChrome,
  evidenceModeIncludesRealProvider,
  evidenceModeRequiresOwnerReceipt,
} from "../shared/law-contracts.js";

const writeJson = (fileName: string, payload: unknown): void => {
  writeFileSync(resolve(generatedDir, fileName), `${JSON.stringify(payload, null, 2)}\n`);
};

const quote = (value: string): string => JSON.stringify(value);

const renderMatrixYaml = (generatedAt: string, rows: readonly EnforcementMatrixRow[]): string => {
  const lines = [`generatedAt: ${quote(generatedAt)}`, "rows:"];
  for (const row of rows) {
    lines.push(`  - capabilityDomain: ${quote(row.capabilityDomain)}`);
    lines.push(`    manifestPath: ${quote(row.manifestPath)}`);
    lines.push(`    ownerInspectorPath: ${quote(row.ownerInspectorPath)}`);
    lines.push("    lawIds:");
    for (const lawId of row.lawIds) {
      lines.push(`      - ${quote(lawId)}`);
    }
  }
  return `${lines.join("\n")}\n`;
};

const writeMatrixArtifacts = (generatedAt: string, matrixRows: readonly EnforcementMatrixRow[]): void => {
  writeJson("enforcement-matrix.generated.json", {
    generatedAt,
    rows: matrixRows,
  });
  writeFileSync(
    resolve(generatedDir, "enforcement-matrix.generated.yaml"),
    renderMatrixYaml(generatedAt, matrixRows),
  );
};

const buildStaticCoverageSummary = (
  laws: readonly LawSource[],
  staticCoverage: readonly StaticClauseCoverageEntry[],
  executedChecks: ReadonlySet<string>,
): {
  activeLawCount: number;
  activeClauseCount: number;
  boundClauseCount: number;
  machineFacetClauseCount: number;
  executedMachineFacetClauseCount: number;
  deferredRealChromeFacetCount: number;
  realChromeFacetClauseIds: string[];
  deferredRealProviderFacetCount: number;
  realProviderFacetClauseIds: string[];
  uncoveredMachineFacetClauseIds: string[];
  coveragePercent: number;
} => {
  const activeLaws = laws.filter((law) => law.status === "active");
  const activeLawCount = activeLaws.length;
  const activeClauseKeys = activeLaws.flatMap((law) =>
    law.clauses.map((clause) => `${law.lawId}::${clause.clauseId}`));
  const coverageByClause = new Map(
    staticCoverage.map((entry) => [`${entry.lawId}::${entry.clauseId}`, entry]),
  );
  const machineCoverage = staticCoverage.filter((entry) => evidenceModeRequiresOwnerReceipt(entry.evidenceMode));
  const executedMachineClauseKeys = new Set(
    machineCoverage
      .filter((entry) => entry.checkIds.every((checkId) =>
        executedChecks.has(`${entry.lawId}::${entry.clauseId}::${checkId}`)))
      .map((entry) => `${entry.lawId}::${entry.clauseId}`),
  );
  const realChromeFacetClauseIds = staticCoverage
    .filter((entry) => evidenceModeIncludesRealChrome(entry.evidenceMode))
    .map((entry) => `${entry.lawId}::${entry.clauseId}`);
  const realProviderFacetClauseIds = staticCoverage
    .filter((entry) => evidenceModeIncludesRealProvider(entry.evidenceMode))
    .map((entry) => `${entry.lawId}::${entry.clauseId}`);
  const uncoveredMachineFacetClauseIds = machineCoverage
    .map((entry) => `${entry.lawId}::${entry.clauseId}`)
    .filter((key) => !executedMachineClauseKeys.has(key));
  const activeClauseCount = activeClauseKeys.length;
  const machineFacetClauseCount = machineCoverage.length;
  return {
    activeLawCount,
    activeClauseCount,
    boundClauseCount: activeClauseKeys.filter((key) => coverageByClause.has(key)).length,
    machineFacetClauseCount,
    executedMachineFacetClauseCount: executedMachineClauseKeys.size,
    deferredRealChromeFacetCount: realChromeFacetClauseIds.length,
    realChromeFacetClauseIds,
    deferredRealProviderFacetCount: realProviderFacetClauseIds.length,
    realProviderFacetClauseIds,
    uncoveredMachineFacetClauseIds,
    coveragePercent: machineFacetClauseCount === 0
      ? 100
      : Math.round(((machineFacetClauseCount - uncoveredMachineFacetClauseIds.length) / machineFacetClauseCount) * 100),
  };
};

export const writeClauseCoverageArtifact = (input: {
  laws: readonly LawSource[];
  staticCoverage: readonly StaticClauseCoverageEntry[];
  executedChecks?: readonly { lawId: string; clauseId: string; checkId: string }[];
}): void => {
  const executedCheckKeys = new Set(
    (input.executedChecks ?? []).map((check) => `${check.lawId}::${check.clauseId}::${check.checkId}`),
  );
  writeJson("static-clause-coverage.generated.json", {
    generatedAt: new Date().toISOString(),
    summary: buildStaticCoverageSummary(input.laws, input.staticCoverage, executedCheckKeys),
    coverage: input.staticCoverage,
  });
};

export const writeGeneratedArtifacts = (input: {
  laws: readonly LawSource[];
  matrixRows: readonly EnforcementMatrixRow[];
  planEntries: readonly AuditPlanEntry[];
  conflicts: readonly AuditConflict[];
  staticCoverage: readonly StaticClauseCoverageEntry[];
}): void => {
  mkdirSync(generatedDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  writeJson("law-registry.generated.json", {
    generatedAt,
    laws: input.laws,
  });
  writeMatrixArtifacts(generatedAt, input.matrixRows);
  writeJson("audit-plan.generated.json", {
    generatedAt,
    entries: input.planEntries,
  });
  writeJson("audit-conflicts.generated.json", {
    generatedAt,
    status: input.conflicts.length === 0 ? "PASS" : "FAIL",
    conflicts: input.conflicts,
  });
  writeClauseCoverageArtifact({
    laws: input.laws,
    staticCoverage: input.staticCoverage,
  });
};
