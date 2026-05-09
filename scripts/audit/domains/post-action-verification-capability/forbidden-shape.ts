import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { LAW_IDS, PATHS } from "./config.js";
import { hasDateOutsideClock, hasForbiddenEscape } from "./escape-rules.js";
import { getOwnedSources, getRepoPath, getSource } from "./project-access.js";

const RESULT_REFINEMENTS_PATH = "src/capabilities/post-action-verification/post-action-result-schema-refinements.ts";

function collectIndexFindings(project: Project): Finding[] {
  const indexSource = getSource(project, `${PATHS.ROOT}/index.ts`);
  return indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())
    ? [createFinding({ lawId: LAW_IDS.SHAPE, file: `${PATHS.ROOT}/index.ts`, line: 1, severity: "fatal", message: "Post Action Verification index.ts must not use export *." })]
    : [];
}

function collectSchemaFindings(project: Project): Finding[] {
  const resultRefinementSource = getSource(project, RESULT_REFINEMENTS_PATH);
  const runtimeProofSource = getSource(project, PATHS.SCHEMA);
  return !hasLiteralTextFragment(resultRefinementSource, "failed/review_required result must not expose output") || !hasLiteralTextFragment(runtimeProofSource, "failed/review_required proof requires diagnosticPayloadRef")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Schema must forbid non-null output/outputRef on non-success results." })]
    : [];
}

function collectOwnedSourceFindings(project: Project): Finding[] {
  for (const sourceFile of getOwnedSources(project)) {
    if (hasForbiddenEscape(sourceFile)) {
      return [createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Forbidden escape tokens or dynamic import/require patterns are not allowed in post-action-verification." })];
    }
    if (hasDateOutsideClock(sourceFile)) {
      return [createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(sourceFile), line: 1, severity: "fatal", message: "Date usage must stay behind verification-clock.ts." })];
    }
  }
  return [];
}

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...collectIndexFindings(project),
    ...collectSchemaFindings(project),
    ...collectOwnedSourceFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("forbidden-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Post Action Verification forbidden shapes are absent." : "Post Action Verification still contains forbidden execution shapes or escape hatches."),
  };
}
