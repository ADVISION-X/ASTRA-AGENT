import { createHash } from "node:crypto";

import { fileExists, readTextFile } from "../../core/filesystem.js";
import { loadDomainManifests } from "../../core/manifests.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { runDomainOwnerInspection } from "../_shared/owner-foundation-inspection.js";
import { buildCoverageMatrix, buildCoverageSummaryWithIntegrity } from "./coverage-matrix-builder.js";
import { buildLawBlueprintCensus } from "./law-blueprint-census.js";
import { writeCoverageArtifacts } from "./coverage-gate.js";

const INSPECTOR_ID = "audit-coverage-governance-owner";
const CAPABILITY_DOMAIN = "audit-coverage-governance";

const createCoverageFinding = (blockers: string[]) => createFinding({
  lawId: "GRASSEYE-AUDIT-COVERAGE-GOVERNANCE-001-V1",
  file: "scripts/audit/generated/uncovered-requirements.generated.json",
  line: 1,
  severity: "fatal",
  message: "Audit coverage governance is blocked by uncovered, weak, or manual-only P0/P1 requirements.",
  detail: blockers.slice(0, 10).join("\n"),
});

const hashText = (text: string): string => createHash("sha256").update(text).digest("hex");

const readHashedFile = async (file: string): Promise<string> => {
  const absolutePath = pathFromRepoRoot(file);
  if (!(await fileExists(absolutePath))) {
    return `${file}:MISSING`;
  }

  return `${file}:${hashText(await readTextFile(absolutePath))}`;
};

const hashFiles = async (files: readonly string[]): Promise<string> => {
  const uniqueFiles = [...new Set(files)].sort();
  const parts = await Promise.all(uniqueFiles.map(readHashedFile));
  return hashText(parts.join("\n"));
};

const buildCoverageIntegrity = async (
  context: InspectorContext,
  manifests: Awaited<ReturnType<typeof loadDomainManifests>>,
  matrix: Awaited<ReturnType<typeof buildCoverageMatrix>>,
) => ({
  sourceLawHash: await hashFiles(context.lawRegistry.laws.map((law) => law.relativeFilePath)),
  sourceBlueprintHash: await hashFiles(manifests.flatMap((manifest) => manifest.readsBlueprintFiles ?? [])),
  inspectorHash: await hashFiles(manifests.flatMap((manifest) => [manifest.manifestPath, manifest.entry])),
  negativeProofHash: await hashFiles(matrix.negativeProofEvidence.map((proof) => proof.harnessPath)),
  packageScriptHash: await hashFiles(["package.json"]),
  auditPlanHash: await hashFiles(["scripts/audit/generated/audit-plan.generated.json"]),
  coverageBuilderVersion: "audit-coverage-governance-anti-fraud-v1",
  antiFraudVerified: false,
});

const buildCoverageSummary = async (context: InspectorContext) => {
  const generatedAt = new Date().toISOString();
  const manifests = await loadDomainManifests();
  const census = await buildLawBlueprintCensus({ lawRegistry: context.lawRegistry, manifests });
  const matrix = await buildCoverageMatrix(census);
  const summary = await buildCoverageSummaryWithIntegrity({
    generatedAt,
    requirements: matrix.requirements,
    integrity: await buildCoverageIntegrity(context, manifests, matrix),
  });
  await writeCoverageArtifacts({
    generatedAt,
    requirements: matrix.requirements,
    negativeProofEvidence: matrix.negativeProofEvidence,
    summary,
  });

  return summary;
};

const buildCoveragePhases = (summary: Awaited<ReturnType<typeof buildCoverageSummary>>): InspectorPhase[] => [
  createPhase(
    "law-blueprint-requirement-census",
    summary.finalVerdict === "PASS" ? "PASS" : "ENFORCEMENT GAP",
    summary.finalVerdict === "PASS",
    `Census generated ${summary.totalRequirements} requirements from active laws and declared blueprints.`,
  ),
  createPhase(
    "coverage-gate",
    summary.finalVerdict === "PASS" ? "PASS" : "FAKE ENFORCEMENT",
    summary.finalVerdict === "PASS",
    `coverageMode=${summary.coverageMode}; weak=${summary.weakCoverage}; missing=${summary.missingCoverage}; manualOnly=${summary.manualOnly}.`,
  ),
];

export const auditCoverageGovernanceInspector: DomainInspector = async (context) => {
  const base = await runDomainOwnerInspection(context, {
    capabilityDomain: CAPABILITY_DOMAIN,
    inspectorId: INSPECTOR_ID,
    inspectorEntry: "scripts/audit/domains/audit-coverage-governance/inspector.ts",
  });
  const summary = await buildCoverageSummary(context);

  const findings = summary.finalVerdict === "PASS"
    ? []
    : [createCoverageFinding(summary.blockers)];

  return finalizeInspectorResult({
    inspector: "Audit Coverage Governance",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings: [...base.findings, ...findings],
    phases: [...base.phases, ...buildCoveragePhases(summary)],
    summary: `Audit coverage governance ${summary.finalVerdict}: ${summary.staticCovered}/${summary.totalRequirements} static covered, ${summary.negativeProofCovered}/${summary.totalRequirements} negative-proof mapped.`,
  });
};

export const inspectAuditCoverageGovernance = auditCoverageGovernanceInspector;
