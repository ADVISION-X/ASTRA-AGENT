import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getMouseClickSourceFiles, makeProject } from "./audit-project.js";
import { FORBIDDEN_TEXT_TOKENS, PATHS } from "./config.js";
import { sourceHasDynamicImport, sourceHasExportStar, sourceHasForbiddenImport, sourceHasNewDateOutsideClock, sourceHasPrimitiveClickCall, sourceHasRequire } from "./source-rules.js";

function getRelativePath(project: ReturnType<typeof makeProject>, filePath: string): string {
  const repoPath = filePath.split("/Users/").length > 1 ? filePath.split("/Users/")[1]! : filePath;
  const normalizedPath = filePath.replace(`${project.getCompilerOptions().rootDir ?? ""}/`, "");
  if (normalizedPath.includes("src/") || normalizedPath.includes("scripts/")) {
    const marker = normalizedPath.includes("src/") ? "src/" : "scripts/";
    return normalizedPath.slice(normalizedPath.indexOf(marker));
  }
  return repoPath;
}

function collectEscapeFindings(sourceFile: ReturnType<typeof getMouseClickSourceFiles>[number], relativePath: string): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasExportStar(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use export *." }));
  }
  if (sourceHasDynamicImport(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use dynamic import escape paths." }));
  }
  if (sourceHasRequire(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use require escape paths." }));
  }
  if (relativePath !== PATHS.CLOCK && sourceHasNewDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must source time from the clock port only." }));
  }
  if (relativePath !== PATHS.RUNNER && sourceHasPrimitiveClickCall(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "primitivePort.click must not appear outside primitive-click-runner." }));
  }
  return findings;
}

function collectImportAndTokenFindings(sourceFile: ReturnType<typeof getMouseClickSourceFiles>[number], relativePath: string): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasForbiddenImport(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not import forbidden ability internals." }));
  }
  return findings.concat(collectForbiddenTokenFindings(sourceFile.getFullText(), relativePath));
}

function collectForbiddenShapeFindings(project: ReturnType<typeof makeProject>, sourceFile: ReturnType<typeof getMouseClickSourceFiles>[number]): Finding[] {
  const relativePath = getRelativePath(project, sourceFile.getFilePath());
  return [
    ...collectEscapeFindings(sourceFile, relativePath),
    ...collectImportAndTokenFindings(sourceFile, relativePath),
  ];
}

function collectForbiddenTokenFindings(fullText: string, relativePath: string): Finding[] {
  return FORBIDDEN_TEXT_TOKENS.filter((token) => fullText.includes(token)).map((token) =>
    createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: `Mouse Click contains forbidden token ${token}.` }),
  );
}

export function runForbiddenShapeAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = getMouseClickSourceFiles(project).flatMap((sourceFile) => collectForbiddenShapeFindings(project, sourceFile));

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Mouse Click avoids export laundering, direct primitive leaks, wall-clock drift, and escape tokens."
        : "Mouse Click still contains forbidden execution shapes or escape hatches.",
    ),
  };
}
