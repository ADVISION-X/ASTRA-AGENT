import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  CLOCK_PORT_PATH,
  FORBIDDEN_TEXT_TOKENS,
  RUNNER_PATH,
  getNerveBusSourceFiles,
  makeProject,
  sourceHasDynamicImport,
  sourceHasExportStar,
  sourceHasForbiddenImport,
  sourceHasNewDateOutsideClock,
  sourceHasRequire,
} from "./ast-utils.js";

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();
  const sourceFiles = getNerveBusSourceFiles(project);

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath().replace(`${project.getCompilerOptions().rootDir ?? ""}/`, "");
    const relativePath = filePath.includes("src/") ? filePath.slice(filePath.indexOf("src/")) : filePath;

    if (sourceHasExportStar(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use export *." }));
    }
    if (sourceHasDynamicImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use dynamic import escape paths." }));
    }
    if (sourceHasRequire(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use require escape paths." }));
    }
    if (relativePath !== RUNNER_PATH && relativePath !== CLOCK_PORT_PATH && sourceHasNewDateOutsideClock(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must source time from the clock port and runtime context only." }));
    }
    if (sourceHasForbiddenImport(sourceFile)) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-002-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not import forbidden capability internals." }));
    }

    const fullText = sourceFile.getFullText();
    for (const token of FORBIDDEN_TEXT_TOKENS) {
      if (fullText.includes(token)) {
        findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: `Nerve Bus contains forbidden token ${token}.` }));
      }
    }

    if (fullText.includes('startsWith("Transport timed out")') && fullText.includes('"missing_handler"')) {
      findings.push(createFinding({ lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1", file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not classify timeout as missing_handler." }));
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
        ? "Nerve Bus avoids export laundering, token escapes, wall-clock drift, and forbidden imports."
        : "Nerve Bus still contains forbidden shapes or escape hatches.",
    ),
  };
}