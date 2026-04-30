import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  CLOCK_PATH,
  FORBIDDEN_TEXT_TOKENS,
  INDEX_PATH,
  RUNNER_PATH,
  getMouseClickSourceFiles,
  makeProject,
  sourceHasDynamicImport,
  sourceHasExportStar,
  sourceHasForbiddenImport,
  sourceHasNewDateOutsideClock,
  sourceHasPrimitiveClickCall,
  sourceHasRequire,
} from "./ast-utils.js";

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  const mouseClickFiles = getMouseClickSourceFiles(project);

  for (const sourceFile of mouseClickFiles) {
    const repoPath = sourceFile.getFilePath().split("/Users/").length > 1
      ? sourceFile.getFilePath().split("/Users/")[1]!
      : sourceFile.getBaseName();
    const filePath = sourceFile.getFilePath().replace(`${project.getCompilerOptions().rootDir ?? ""}/`, "");
    const relativePath = filePath.includes("src/") || filePath.includes("scripts/")
      ? filePath.slice(filePath.indexOf(filePath.includes("src/") ? "src/" : "scripts/"))
      : repoPath;

    if (sourceHasExportStar(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use export *." }));
    }
    if (sourceHasDynamicImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use dynamic import escape paths." }));
    }
    if (sourceHasRequire(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not use require escape paths." }));
    }
    if (relativePath !== CLOCK_PATH && sourceHasNewDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must source time from the clock port only." }));
    }
    if (relativePath !== RUNNER_PATH && sourceHasPrimitiveClickCall(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "primitivePort.click must not appear outside primitive-click-runner." }));
    }
    if (sourceHasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Mouse Click must not import forbidden ability internals." }));
    }

    const fullText = sourceFile.getFullText();
    for (const token of FORBIDDEN_TEXT_TOKENS) {
      if (fullText.includes(token)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-005-V1", file: relativePath, line: 1, severity: "fatal", message: `Mouse Click contains forbidden token ${token}.` }));
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
        ? "Mouse Click avoids export laundering, direct primitive leaks, wall-clock drift, and escape tokens."
        : "Mouse Click still contains forbidden execution shapes or escape hatches.",
    ),
  };
}
