import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getPageStateSources, getSource } from "./audit-project.js";
import { ROOT } from "./constants.js";
import { hasDateOutsideClock, hasForbiddenCapabilityImport, hasForbiddenEscape } from "./source-boundaries.js";
import type { Project } from "ts-morph";

const toRepoPath = (absolutePath: string): string =>
  absolutePath.split("/Users/nexgen/Documents/GrassEye -AI-AGENT/").pop() ?? absolutePath;

const inspectSourceFile = (repoPath: string, sourceFile: ReturnType<typeof getPageStateSources>[number]): Finding[] => {
  const findings: Finding[] = [];

  if (hasForbiddenEscape(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State root must not use escape hatches or dynamic import patterns." }));
  }
  if (hasDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State runtime must not use Date outside the clock boundary." }));
  }
  if (hasForbiddenCapabilityImport(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: "Page State must not import forbidden capability implementations." }));
  }

  return findings;
};

const inspectRuntimeSources = (project: Project): Finding[] =>
  getPageStateSources(project).flatMap((sourceFile) => inspectSourceFile(toRepoPath(sourceFile.getFilePath()), sourceFile));

const inspectIndexSource = (project: Project): Finding[] => {
  const indexSource = getSource(project, `${ROOT}/index.ts`);
  return indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: `${ROOT}/index.ts`, line: 1, severity: "fatal", message: "Page State index must not use export-star barrels." })]
    : [];
};

const inspectSchemaSource = (project: Project): Finding[] => {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const schemaText = schemaSource.getFullText();
  const hasGovernedNullOutput = schemaText.includes("failed or review_required result must null output");
  const hasGovernedNullOutputRef = schemaText.includes("failed or review_required proof must null outputRef");

  return hasGovernedNullOutput && hasGovernedNullOutputRef
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must forbid non-null output or outputRef on non-success results." })];
};

export async function runForbiddenShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...inspectRuntimeSources(project),
    ...inspectIndexSource(project),
    ...inspectSchemaSource(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-forbidden-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State forbidden shapes are absent." : "Page State still contains forbidden shapes or escape hatches."),
  };
}