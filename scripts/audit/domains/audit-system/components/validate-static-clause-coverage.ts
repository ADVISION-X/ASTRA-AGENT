import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { fileExists, readJsonFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import {
  buildStaticClauseCoverageArtifact,
  type StaticClauseCoverageArtifact,
} from "../../../core/static-clause-coverage-artifact.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

const normalizeArtifact = (artifact: StaticClauseCoverageArtifact): StaticClauseCoverageArtifact => ({
  ...artifact,
  generatedAt: "__GENERATED_AT__",
});

const stringifyArtifact = (artifact: StaticClauseCoverageArtifact): string =>
  `${JSON.stringify(normalizeArtifact(artifact), null, 2)}\n`;

const createArtifactFinding = (message: string): Finding =>
  createFinding({
    lawId: LAW_ID,
    file: generatedArtifactPaths.staticClauseCoverage,
    line: 1,
    severity: "fatal",
    message,
  });

const getMissingLawFindings = (artifact: StaticClauseCoverageArtifact, context: InspectorContext): Finding[] => {
  const actualLawIds = new Set(artifact.laws.map((law) => law.lawId));
  return context.lawRegistry.laws
    .filter((law) => !actualLawIds.has(law.lawId))
    .map((law) => createFinding({
      lawId: LAW_ID,
      file: generatedArtifactPaths.staticClauseCoverage,
      line: 1,
      severity: "fatal",
      message: `static-clause-coverage must include active law ${law.lawId}.`,
      detail: law.capabilityDomain,
    }));
};

const getAbilityGroupCountFindings = (artifact: StaticClauseCoverageArtifact): Finding[] => {
  if (artifact.abilityGroupCount === 14 && artifact.abilityGroupDomains.length === 14) {
    return [];
  }

  return [createArtifactFinding("static-clause-coverage must keep the 14 governed ability groups intact.")];
};

const getLawCoverageFindings = (artifact: StaticClauseCoverageArtifact): Finding[] => {
  const findings: Finding[] = [];

  for (const law of artifact.laws) {
    if (!law.matrixMapped) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.ownerManifestPath,
        line: 1,
        severity: "fatal",
        message: "static-clause-coverage requires every active law to remain mapped in the generated enforcement matrix.",
      }));
    }
    if (!law.auditPlanMapped) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.ownerInspectorEntry,
        line: 1,
        severity: "fatal",
        message: "static-clause-coverage requires every active law to remain mapped in the generated audit plan.",
      }));
    }
    if (!law.inspectorMapped || law.sourceEvidence.length === 0) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.ownerInspectorEntry,
        line: 1,
        severity: "fatal",
        message: "Owner inspector must expose concrete source evidence for every active law.",
      }));
    }
    if (!law.negativeProofMapped) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.negativeProofPath,
        line: 1,
        severity: "fatal",
        message: "Owner negative-proof harness is required for static clause coverage.",
      }));
    }
    if (!law.ownerAuditScriptDeclared) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: "package.json",
        line: 1,
        severity: "fatal",
        message: "package.json must keep the owner audit script bound for every governed ability group.",
      }));
    }
    if (!law.mutationProofPresent) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.mutationProofPath ?? generatedArtifactPaths.staticClauseCoverage,
        line: 1,
        severity: "error",
        message: "Production mutation proof bundle is required before a law can progress beyond NEGATIVE_PROOF_MAPPED.",
      }));
    }
    if (!law.ownerBindingProofPresent) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: law.ownerBindingProofPath ?? generatedArtifactPaths.staticClauseCoverage,
        line: 1,
        severity: "error",
        message: "Owner-binding proof bundle is required before a law can progress beyond MUTATION_PROOF_CAPTURED.",
      }));
    }
    if (law.coverageStatus === "ENFORCED" && !artifact.globalChain.passed) {
      findings.push(createFinding({
        lawId: law.lawId,
        file: generatedArtifactPaths.staticClauseCoverage,
        line: 1,
        severity: "fatal",
        message: "No law may be marked ENFORCED while the global chain is failing.",
      }));
    }
  }

  return findings;
};

const getArtifactFreshnessFindings = async (
  context: InspectorContext,
  actualArtifact: StaticClauseCoverageArtifact,
): Promise<Finding[]> => {
  const expectedArtifact = await buildStaticClauseCoverageArtifact({
    lawRegistry: context.lawRegistry,
    enforcementMatrix: context.enforcementMatrix,
    auditPlan: context.auditPlan,
  });

  return stringifyArtifact(actualArtifact) === stringifyArtifact(expectedArtifact)
    ? []
    : [createArtifactFinding("static-clause-coverage generated artifact drifted away from the rebuild output; generated files must not be hand-edited.")];
};

const createStaticClauseCoveragePhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "static-clause-coverage",
    findings.length === 0 ? "PASS" : "ENFORCEMENT GAP",
    findings.length === 0,
    findings.length === 0
      ? "static-clause-coverage is generated, clause-complete, and bound to the current global enforcement chain."
      : "static-clause-coverage is missing, drifted, or still allows uncovered/fake-green laws.",
  );

export const validateStaticClauseCoverage = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  if (!(await fileExists(generatedArtifactPaths.staticClauseCoverage))) {
    const findings = [createArtifactFinding("static-clause-coverage generated artifact is missing.")];
    return { findings, phases: [createStaticClauseCoveragePhase(findings)] };
  }

  const artifact = await readJsonFile<StaticClauseCoverageArtifact>(generatedArtifactPaths.staticClauseCoverage);
  const findings = [
    ...getAbilityGroupCountFindings(artifact),
    ...getMissingLawFindings(artifact, context),
    ...getLawCoverageFindings(artifact),
    ...await getArtifactFreshnessFindings(context, artifact),
  ];

  return {
    findings,
    phases: [createStaticClauseCoveragePhase(findings)],
  };
};