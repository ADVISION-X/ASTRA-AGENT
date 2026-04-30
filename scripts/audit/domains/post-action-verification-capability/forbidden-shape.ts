import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-helpers.js";
import { getOwnedSources, getSource, hasDateOutsideClock, hasForbiddenEscape, ROOT } from "./ast-utils.js";

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const indexSource = getSource(project, `${ROOT}/index.ts`);
  if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: `${ROOT}/index.ts`, line: 1, severity: "fatal", message: "Post Action Verification index.ts must not use export *." }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  if (!hasLiteralTextFragment(schemaSource, "failed/review_required result must not expose output") || !hasLiteralTextFragment(schemaSource, "failed/review_required proof requires diagnosticPayloadRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Schema must forbid non-null output/outputRef on non-success results." }));
  }

  for (const sourceFile of getOwnedSources(project)) {
    if (hasForbiddenEscape(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: sourceFile.getFilePath(), line: 1, severity: "fatal", message: "Forbidden escape tokens or dynamic import/require patterns are not allowed in post-action-verification." }));
      break;
    }
    if (hasDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-POST-ACTION-VERIFICATION-CAPABILITY-004-V1", file: sourceFile.getFilePath(), line: 1, severity: "fatal", message: "Date usage must stay behind verification-clock.ts." }));
      break;
    }
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("forbidden-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification forbidden shapes are absent." : "Post Action Verification still contains forbidden execution shapes or escape hatches."),
  };
}