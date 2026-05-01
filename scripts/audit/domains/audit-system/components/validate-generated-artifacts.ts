import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const getMissingGeneratedArtifactFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const requiredFiles = [
    generatedArtifactPaths.lawRegistry,
    generatedArtifactPaths.enforcementMatrixJson,
    generatedArtifactPaths.enforcementMatrixYaml,
    generatedArtifactPaths.auditPlan,
    generatedArtifactPaths.auditConflicts,
    generatedArtifactPaths.touchedFiles,
  ];

  for (const requiredFile of requiredFiles) {
    if (await fileExists(requiredFile)) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
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
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
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
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
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
      ? "Generated registry, matrix, plan, and conflicts are present and readable."
      : "Generated artifacts are missing or malformed.",
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