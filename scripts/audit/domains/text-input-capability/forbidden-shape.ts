import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { FORBIDDEN_TEXT_TOKENS, LAW_IDS, PATHS } from "./config.js";
import { getTextInputSourceFiles, makeProject, toRepoPath } from "./project-access.js";
import { sourceHasDynamicImport, sourceHasExportStar, sourceHasForbiddenImport, sourceHasNewDateOutsideClock, sourceHasPrimitiveExecuteCall, sourceHasRequire } from "./source-rules.js";

function collectStructuralFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasExportStar(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use export *." }));
  }
  if (sourceHasDynamicImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use dynamic import escape paths." }));
  }
  if (sourceHasRequire(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use require escape paths." }));
  }
  for (const token of FORBIDDEN_TEXT_TOKENS) {
    if (sourceText.includes(token)) {
      findings.push(createFinding({ lawId: LAW_IDS.PACKAGE, file: relativePath, line: 1, severity: "fatal", message: `Text Input contains forbidden token ${token}.` }));
    }
  }
  return findings;
}

function collectExecutionFindings(relativePath: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (relativePath !== PATHS.CLOCK && sourceHasNewDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "Text Input must source time from the clock port only." }));
  }
  if (relativePath !== PATHS.RUNNER && sourceHasPrimitiveExecuteCall(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: relativePath, line: 1, severity: "fatal", message: "executionPort.execute must not appear outside primitive-text-input-runner." }));
  }
  return sourceHasForbiddenImport(sourceFile)
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: relativePath, line: 1, severity: "fatal", message: "Text Input must not import forbidden ability or browser internals." }))
    : findings;
}

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  for (const sourceFile of getTextInputSourceFiles(project)) {
    const relativePath = toRepoPath(sourceFile);
    const fullText = sourceFile.getFullText();
    findings.push(...collectStructuralFindings(relativePath, fullText, sourceFile));
    findings.push(...collectExecutionFindings(relativePath, sourceFile));
  }

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Text Input avoids export laundering, direct primitive leaks, wall-clock drift, and escape tokens."
        : "Text Input still contains forbidden execution shapes or escape hatches.",
    ),
  };
}