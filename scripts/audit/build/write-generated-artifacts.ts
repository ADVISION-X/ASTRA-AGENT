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

const writeJson = (fileName: string, payload: unknown): void => {
  writeFileSync(resolve(generatedDir, fileName), `${JSON.stringify(payload, null, 2)}\n`);
};

const quote = (value: string): string => JSON.stringify(value);

const countActiveLaws = (laws: readonly LawSource[]): number => laws.filter((law) => law.status === "active").length;

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
): {
  activeLawCount: number;
  coveredLawCount: number;
  coveragePercent: number;
} => {
  const activeLawCount = countActiveLaws(laws);
  return {
    activeLawCount,
    coveredLawCount: staticCoverage.length,
    coveragePercent: activeLawCount === 0 ? 100 : Math.round((staticCoverage.length / activeLawCount) * 100),
  };
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
  writeJson("static-clause-coverage.generated.json", {
    generatedAt,
    summary: buildStaticCoverageSummary(input.laws, input.staticCoverage),
    coverage: input.staticCoverage,
  });
};