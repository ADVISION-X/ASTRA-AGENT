import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/paths.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

export const validateGeneratedArtifacts = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];

  const requiredFiles = [
    generatedArtifactPaths.lawRegistry,
    generatedArtifactPaths.enforcementMatrixJson,
    generatedArtifactPaths.enforcementMatrixYaml,
    generatedArtifactPaths.auditPlan,
    generatedArtifactPaths.auditConflicts,
  ];

  for (const requiredFile of requiredFiles) {
    if (!(await fileExists(requiredFile))) {
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
  }

  const yamlText = await readTextFile(generatedArtifactPaths.enforcementMatrixYaml);
  if (!yamlText.includes("generatedAt:") || !yamlText.includes("owners:")) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: generatedArtifactPaths.enforcementMatrixYaml,
        line: 1,
        severity: "error",
        message: "Generated YAML artifact is unreadable or incomplete.",
      }),
    );
  }

  if (context.auditPlan.owners.length === 0) {
    findings.push(
      createFinding({
        lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
        file: generatedArtifactPaths.auditPlan,
        line: 1,
        severity: "fatal",
        message: "Generated audit plan must not be empty.",
      }),
    );
  }

  phases.push(
    createPhase(
      "generated-artifacts",
      findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
      findings.length === 0,
      findings.length === 0
        ? "Generated registry, matrix, plan, and conflicts are present and readable."
        : "Generated artifacts are missing or malformed.",
    ),
  );

  return { findings, phases };
};