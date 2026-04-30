import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { ROOT, getPageStateSources, getSource, hasDateOutsideClock, hasForbiddenCapabilityImport, hasForbiddenEscape } from "./ast-utils.js";
import type { Project } from "ts-morph";

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const sources = getPageStateSources(project);

  for (const sourceFile of sources) {
    const repoPath = sourceFile.getFilePath().split("/Users/nexgen/Documents/GrassEye -AI-AGENT/").pop() ?? sourceFile.getBaseName();
    if (hasForbiddenEscape(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State root must not use escape hatches or dynamic import patterns." }));
    }
    if (hasDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State runtime must not use Date outside the clock boundary." }));
    }
    if (hasForbiddenCapabilityImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State must not import forbidden capability implementations." }));
    }
  }

  const indexSource = getSource(project, `${ROOT}/index.ts`);
  if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: `${ROOT}/index.ts`, line: 1, severity: "fatal", message: "Page State index must not use export-star barrels." }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  if (!schemaSource.getFullText().includes("failed or review_required result must null output") || !schemaSource.getFullText().includes("failed or review_required proof must null outputRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must forbid non-null output or outputRef on non-success results." }));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-forbidden-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State forbidden shapes are absent." : "Page State still contains forbidden shapes or escape hatches."),
  };
}