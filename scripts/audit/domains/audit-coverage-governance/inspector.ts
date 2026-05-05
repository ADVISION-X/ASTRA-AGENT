import { loadDomainManifests } from "../../core/manifests.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { buildCoverageMatrix, buildCoverageSummary } from "./coverage-matrix-builder.js";
import { buildLawBlueprintCensus } from "./law-blueprint-census.js";
import { writeCoverageArtifacts } from "./coverage-gate.js";

const INSPECTOR_ID = "audit-coverage-governance-owner";
const CAPABILITY_DOMAIN = "audit-coverage-governance";

export const inspectAuditCoverageGovernance: DomainInspector = async (context) => {
  const generatedAt = new Date().toISOString();
  const manifests = await loadDomainManifests();
  const census = await buildLawBlueprintCensus({ lawRegistry: context.lawRegistry, manifests });
  const matrix = await buildCoverageMatrix(census);
  const summary = buildCoverageSummary(matrix.requirements, generatedAt);
  await writeCoverageArtifacts({
    generatedAt,
    requirements: matrix.requirements,
    negativeProofEvidence: matrix.negativeProofEvidence,
    summary,
  });

  const findings = summary.finalVerdict === "PASS"
    ? []
    : [
      createFinding({
        lawId: "GRASSEYE-AUDIT-COVERAGE-GOVERNANCE-001-V1",
        file: "scripts/audit/generated/uncovered-requirements.generated.json",
        line: 1,
        severity: "fatal",
        message: "Audit coverage governance is blocked by uncovered, weak, or manual-only P0/P1 requirements.",
        detail: summary.blockers.slice(0, 10).join("\n"),
      }),
    ];

  return finalizeInspectorResult({
    inspector: "Audit Coverage Governance",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings,
    phases: [
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
    ],
    summary: `Audit coverage governance ${summary.finalVerdict}: ${summary.staticCovered}/${summary.totalRequirements} static covered, ${summary.negativeProofCovered}/${summary.totalRequirements} negative-proof mapped.`,
  });
};
