import { writeGeneratedJson } from "../../core/generated-artifact.js";
import { writeAuditArtifactProvenance } from "../../core/generated-provenance.js";
import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext, InspectorResult } from "../../core/schema.js";

import { runAuditSystemAntiEscape } from "./components/anti-escape.js";
import { runCiFullCoverage } from "./components/ci-full-coverage.js";
import { runInspectorQualityGate } from "./components/inspector-quality-gate.js";
import { runLawCensus } from "./components/law-census.js";
import { runOwnerManifestCensus } from "./components/owner-manifest-census.js";
import { buildOwnerInspectorMatrix } from "./components/owner-inspector-matrix.js";
import { buildAllLawEnforcementMatrix } from "../../law-enforcement/all-law-enforcement-matrix.js";

const buildAllLawEnforcementInput = (input: {
  lawCensus: ReturnType<typeof runLawCensus>;
  manifestCensus: ReturnType<typeof runOwnerManifestCensus>;
  ciFullCoverage: ReturnType<typeof runCiFullCoverage>;
  inspectorQualityGate: ReturnType<typeof runInspectorQualityGate>;
  antiEscape: ReturnType<typeof runAuditSystemAntiEscape>;
}) => ({
  laws: input.lawCensus.laws,
  manifests: input.manifestCensus.manifests,
  lawCensusFindings: input.lawCensus.findings,
  manifestFindings: input.manifestCensus.findings,
  ciFullFindings: input.ciFullCoverage.findings,
  inspectorQualityFindings: input.inspectorQualityGate.findings,
  antiEscapeFindings: input.antiEscape.findings,
});

const collectAuditSystemFindings = (input: {
  lawCensus: ReturnType<typeof runLawCensus>;
  manifestCensus: ReturnType<typeof runOwnerManifestCensus>;
  ciFullCoverage: ReturnType<typeof runCiFullCoverage>;
  inspectorQualityGate: ReturnType<typeof runInspectorQualityGate>;
  antiEscape: ReturnType<typeof runAuditSystemAntiEscape>;
  allLawEnforcement: Awaited<ReturnType<typeof buildAllLawEnforcementMatrix>>;
}) => [
  ...input.lawCensus.findings,
  ...input.manifestCensus.findings,
  ...input.ciFullCoverage.findings,
  ...input.inspectorQualityGate.findings,
  ...input.antiEscape.findings,
  ...input.allLawEnforcement.findings,
];

const buildAuditSystemPhases = (input: {
  lawCensus: ReturnType<typeof runLawCensus>;
  manifestCensus: ReturnType<typeof runOwnerManifestCensus>;
  ciFullCoverage: ReturnType<typeof runCiFullCoverage>;
  inspectorQualityGate: ReturnType<typeof runInspectorQualityGate>;
  antiEscape: ReturnType<typeof runAuditSystemAntiEscape>;
  allLawEnforcement: Awaited<ReturnType<typeof buildAllLawEnforcementMatrix>>;
}) => [
  createPhase("law-census", input.lawCensus.findings.length === 0 ? "PASS" : "LAW GAP", input.lawCensus.findings.length === 0, "active law census checked."),
  createPhase("owner-manifests", input.manifestCensus.findings.length === 0 ? "PASS" : "ENFORCEMENT GAP", input.manifestCensus.findings.length === 0, "owner manifest coverage checked."),
  createPhase("ci-full-coverage", input.ciFullCoverage.findings.length === 0 ? "PASS" : "ENFORCEMENT MISS", input.ciFullCoverage.findings.length === 0, "CI-FULL owner coverage checked."),
  createPhase("inspector-quality", input.inspectorQualityGate.findings.length === 0 ? "PASS" : "INVALID ENFORCEMENT", input.inspectorQualityGate.findings.length === 0, "owner inspector quality checked."),
  createPhase("anti-escape", input.antiEscape.findings.length === 0 ? "PASS" : "CODE VIOLATION", input.antiEscape.findings.length === 0, "anti-escape checked."),
  createPhase("all-law-enforcement", input.allLawEnforcement.result.status === "PASS" ? "PASS" : "ENFORCEMENT MISS", input.allLawEnforcement.result.status === "PASS", "global law enforcement matrix checked."),
];

const writeAuditSystemSummary = (input: {
  passed: boolean;
  lawCensus: ReturnType<typeof runLawCensus>;
  manifestCensus: ReturnType<typeof runOwnerManifestCensus>;
  matrix: ReturnType<typeof buildOwnerInspectorMatrix>;
  allLawEnforcement: Awaited<ReturnType<typeof buildAllLawEnforcementMatrix>>;
  findings: InspectorResult["findings"];
}) => {
  writeGeneratedJson("audit-system-summary.generated.json", {
    generatedAt: new Date().toISOString(),
    passed: input.passed,
    lawCount: input.lawCensus.lawCount,
    domainCount: input.lawCensus.domainCount,
    manifestCount: input.manifestCensus.manifests.length,
    matrixDomainCount: input.matrix.domains.length,
    allLawEnforcement: input.allLawEnforcement.result,
    findings: input.findings,
  });
};

const runAuditSystemChecks = async () => {
  const lawCensus = runLawCensus();
  const manifestCensus = runOwnerManifestCensus(lawCensus.laws);
  const matrix = buildOwnerInspectorMatrix(lawCensus.laws, manifestCensus.manifests);
  const ciFullCoverage = runCiFullCoverage(manifestCensus.manifests, matrix.domains);
  const inspectorQualityGate = runInspectorQualityGate(manifestCensus.manifests);
  const antiEscape = runAuditSystemAntiEscape();
  writeAuditArtifactProvenance();
  const allLawEnforcement = await buildAllLawEnforcementMatrix(buildAllLawEnforcementInput({
    lawCensus,
    manifestCensus,
    ciFullCoverage,
    inspectorQualityGate,
    antiEscape,
  }));
  return { lawCensus, manifestCensus, matrix, ciFullCoverage, inspectorQualityGate, antiEscape, allLawEnforcement };
};

const buildAuditSystemResult = (input: {
  passed: boolean;
  findings: InspectorResult["findings"];
  phases: InspectorResult["phases"];
}) => finalizeInspectorResult({
  inspector: "audit-system",
  inspectorId: "audit-system-owner",
  capabilityDomain: "audit-system",
  findings: input.findings,
  phases: input.phases,
  summary: input.passed
    ? "audit-system owner coverage is closed."
    : "audit-system owner coverage has blocking gaps.",
});

export async function runAuditSystemInspector(_context: InspectorContext): Promise<InspectorResult> {
  const state = await runAuditSystemChecks();
  const findings = collectAuditSystemFindings(state);
  const passed = findings.length === 0;
  const phases = buildAuditSystemPhases(state);

  writeAuditSystemSummary({ passed, ...state, findings });
  writeAuditArtifactProvenance();

  return buildAuditSystemResult({ passed, findings, phases });
}
