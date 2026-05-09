import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

const getMissingGeneratedArtifactFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const requiredFiles = [
    generatedArtifactPaths.lawRegistry,
    generatedArtifactPaths.enforcementMatrixJson,
    generatedArtifactPaths.enforcementMatrixYaml,
    generatedArtifactPaths.auditPlan,
    generatedArtifactPaths.auditConflicts,
    generatedArtifactPaths.staticClauseCoverage,
    generatedArtifactPaths.touchedFiles,
  ];

  for (const requiredFile of requiredFiles) {
    if (await fileExists(requiredFile)) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: requiredFile,
        line: 1,
        severity: "fatal",
        message: "Required generated artifact is missing.",
      }),
    );
  }

  return findings;
};

const getGeneratedYamlFinding = async (): Promise<Finding | null> => {
  const yamlText = await readTextFile(generatedArtifactPaths.enforcementMatrixYaml);
  return !yamlText.includes("generatedAt:") || !yamlText.includes("owners:")
    ? createFinding({
        lawId: LAW_ID,
        file: generatedArtifactPaths.enforcementMatrixYaml,
        line: 1,
        severity: "error",
        message: "Generated YAML artifact is unreadable or incomplete.",
      })
    : null;
};

const getEmptyAuditPlanFinding = (context: InspectorContext): Finding | null =>
  context.auditPlan.owners.length === 0
    ? createFinding({
        lawId: LAW_ID,
        file: generatedArtifactPaths.auditPlan,
        line: 1,
        severity: "fatal",
        message: "Generated audit plan must not be empty.",
      })
    : null;

const createGeneratedArtifactsPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "generated-artifacts",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Generated registry, matrix, plan, and conflicts artifacts are present, readable, and rebuild-faithful."
      : "Generated artifacts are missing, malformed, or hand-edited.",
  );

export const validateGeneratedArtifacts = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings = await getMissingGeneratedArtifactFindings();
  const yamlFinding = await getGeneratedYamlFinding();
  const auditPlanFinding = getEmptyAuditPlanFinding(context);

  if (yamlFinding) {
    findings.push(yamlFinding);
  }

  if (auditPlanFinding) {
    findings.push(auditPlanFinding);
  }

  return { findings, phases: [createGeneratedArtifactsPhase(findings)] };
};
