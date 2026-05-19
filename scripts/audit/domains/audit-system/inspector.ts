import { writeGeneratedJson } from "../../core/generated-artifact.js";
import { createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { InspectorContext, InspectorResult } from "../../core/schema.js";

import { runAuditSystemAntiEscape } from "./components/anti-escape.js";
import { runCiFullCoverage } from "./components/ci-full-coverage.js";
import { runInspectorQualityGate } from "./components/inspector-quality-gate.js";
import { runLawCensus } from "./components/law-census.js";
import { runOwnerManifestCensus } from "./components/owner-manifest-census.js";
import { buildOwnerInspectorMatrix } from "./components/owner-inspector-matrix.js";
import { buildAllLawEnforcementMatrix } from "../../law-enforcement/all-law-enforcement-matrix.js";

export async function runAuditSystemInspector(_context: InspectorContext): Promise<InspectorResult> {
  const lawCensus = runLawCensus();
  const manifestCensus = runOwnerManifestCensus(lawCensus.laws);
  const matrix = buildOwnerInspectorMatrix(lawCensus.laws, manifestCensus.manifests);
  const ciFullCoverage = runCiFullCoverage(manifestCensus.manifests, matrix.domains);
  const inspectorQualityGate = runInspectorQualityGate(manifestCensus.manifests);
  const antiEscape = runAuditSystemAntiEscape();
  const allLawEnforcement = await buildAllLawEnforcementMatrix({
    laws: lawCensus.laws,
    manifests: manifestCensus.manifests,
    lawCensusFindings: lawCensus.findings,
    manifestFindings: manifestCensus.findings,
    ciFullFindings: ciFullCoverage.findings,
    inspectorQualityFindings: inspectorQualityGate.findings,
    antiEscapeFindings: antiEscape.findings,
  });

  const findings = [
    ...lawCensus.findings,
    ...manifestCensus.findings,
    ...ciFullCoverage.findings,
    ...inspectorQualityGate.findings,
    ...antiEscape.findings,
    ...allLawEnforcement.findings,
  ];
  const passed = findings.length === 0;
  const phases = [
    createPhase("law-census", lawCensus.findings.length === 0 ? "PASS" : "LAW GAP", lawCensus.findings.length === 0, "active law census checked."),
    createPhase("owner-manifests", manifestCensus.findings.length === 0 ? "PASS" : "ENFORCEMENT GAP", manifestCensus.findings.length === 0, "owner manifest coverage checked."),
    createPhase("ci-full-coverage", ciFullCoverage.findings.length === 0 ? "PASS" : "ENFORCEMENT MISS", ciFullCoverage.findings.length === 0, "CI-FULL owner coverage checked."),
    createPhase("inspector-quality", inspectorQualityGate.findings.length === 0 ? "PASS" : "INVALID ENFORCEMENT", inspectorQualityGate.findings.length === 0, "owner inspector quality checked."),
    createPhase("anti-escape", antiEscape.findings.length === 0 ? "PASS" : "CODE VIOLATION", antiEscape.findings.length === 0, "anti-escape checked."),
    createPhase("all-law-enforcement", allLawEnforcement.result.status === "PASS" ? "PASS" : "ENFORCEMENT MISS", allLawEnforcement.result.status === "PASS", "global law enforcement matrix checked."),
  ];

  writeGeneratedJson("audit-system-summary.generated.json", {
    generatedAt: new Date().toISOString(),
    passed,
    lawCount: lawCensus.lawCount,
    domainCount: lawCensus.domainCount,
    manifestCount: manifestCensus.manifests.length,
    matrixDomainCount: matrix.domains.length,
    allLawEnforcement: allLawEnforcement.result,
    findings,
  });

  return finalizeInspectorResult({
    inspector: "audit-system",
    inspectorId: "audit-system-owner",
    capabilityDomain: "audit-system",
    findings,
    phases,
    summary: passed
      ? "audit-system owner coverage is closed."
      : "audit-system owner coverage has blocking gaps.",
  });
}