import { createAuditSystemPhase } from "./audit-system-component-support.js";
import type { AuditSystemInspectionContext, AuditSystemInspectionResult } from "./audit-system-ts-morph-support.js";
import { getAuditProject, getSourceFileOrThrow, toRelativeSourcePath } from "./audit-system-ts-morph-support.js";
import { collectRunnerBoundaryFindings } from "./validate-runner-boundary-findings.js";

export const validateRunnerBoundary = async (
  _context: AuditSystemInspectionContext,
): Promise<AuditSystemInspectionResult> => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, "scripts/audit/runner.ts");
  const relativePath = toRelativeSourcePath(sourceFile);
  const findings = collectRunnerBoundaryFindings(sourceFile, relativePath);
  const phases = [
    createAuditSystemPhase(
      "runner-boundary",
      findings.length === 0 ? "PASS" : "SCRIPT OVERREACH",
      findings.length === 0,
      findings.length === 0
        ? "Runner stays on the generated-plan boundary."
        : "Runner contains boundary drift or manual ownership logic.",
    ),
  ];

  return { findings, phases };
};