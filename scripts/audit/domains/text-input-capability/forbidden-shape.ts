import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  CLOCK_PATH,
  FORBIDDEN_TEXT_TOKENS,
  RUNNER_PATH,
  getTextInputSourceFiles,
  makeProject,
  sourceHasDynamicImport,
  sourceHasExportStar,
  sourceHasForbiddenImport,
  sourceHasNewDateOutsideClock,
  sourceHasPrimitiveExecuteCall,
  sourceHasRequire,
} from "./ast-utils.js";

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  const textInputFiles = getTextInputSourceFiles(project);

  for (const sourceFile of textInputFiles) {
    const filePath = sourceFile.getFilePath();
    const relativePath = filePath.includes("src/") || filePath.includes("scripts/")
      ? filePath.slice(filePath.indexOf(filePath.includes("src/") ? "src/" : "scripts/"))
      : sourceFile.getBaseName();

    if (sourceHasExportStar(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use export *." }));
    }
    if (sourceHasDynamicImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use dynamic import escape paths." }));
    }
    if (sourceHasRequire(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: relativePath, line: 1, severity: "fatal", message: "Text Input must not use require escape paths." }));
    }
    if (relativePath !== CLOCK_PATH && sourceHasNewDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Text Input must source time from the clock port only." }));
    }
    if (relativePath !== RUNNER_PATH && sourceHasPrimitiveExecuteCall(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "executionPort.execute must not appear outside primitive-text-input-runner." }));
    }
    if (sourceHasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-001-V1", file: relativePath, line: 1, severity: "fatal", message: "Text Input must not import forbidden ability or browser internals." }));
    }

    const fullText = sourceFile.getFullText();
    for (const token of FORBIDDEN_TEXT_TOKENS) {
      if (fullText.includes(token)) {
        findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-007-V1", file: relativePath, line: 1, severity: "fatal", message: `Text Input contains forbidden token ${token}.` }));
      }
    }
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