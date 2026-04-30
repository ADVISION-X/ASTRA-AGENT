import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  CLOCK_PATH,
  FORBIDDEN_TEXT_TOKENS,
  RUNNER_PATH,
  getMouseScrollSourceFiles,
  makeProject,
  sourceHasDynamicImport,
  sourceHasExportStar,
  sourceHasForbiddenImport,
  sourceHasNewDateOutsideClock,
  sourceHasPrimitiveScrollCall,
  sourceHasRequire,
} from "./ast-utils.js";

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  const sourceFiles = getMouseScrollSourceFiles(project);

  for (const sourceFile of sourceFiles) {
    const relativePath = sourceFile.getFilePath().includes("src/")
      ? sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf("src/"))
      : sourceFile.getFilePath().slice(sourceFile.getFilePath().indexOf("scripts/"));

    if (sourceHasExportStar(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use export *." }));
    }
    if (sourceHasDynamicImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use dynamic import escape paths." }));
    }
    if (sourceHasRequire(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not use require escape paths." }));
    }
    if (relativePath !== CLOCK_PATH && sourceHasNewDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must source time from the clock port only." }));
    }
    if (relativePath !== RUNNER_PATH && sourceHasPrimitiveScrollCall(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-001-V1", file: relativePath, line: 1, severity: "fatal", message: "primitivePort.scroll must not appear outside primitive-scroll-runner." }));
    }
    if (sourceHasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Scroll must not import forbidden ability internals." }));
    }

    const fullText = sourceFile.getFullText();
    for (const token of FORBIDDEN_TEXT_TOKENS) {
      if (fullText.includes(token)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: `Mouse Scroll contains forbidden token ${token}.` }));
      }
    }
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll avoids export laundering, direct primitive leaks, wall-clock drift, and escape tokens."
        : "Mouse Scroll still contains forbidden execution shapes or escape hatches.",
    ),
  };
}