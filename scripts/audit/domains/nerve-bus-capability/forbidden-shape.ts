import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { FORBIDDEN_TEXT_TOKENS, LAW_IDS, PATHS } from "./config.js";
import { getNerveBusSourceFiles, makeProject, toRepoPath } from "./project-access.js";
import { sourceHasDynamicImport, sourceHasExportStar, sourceHasForbiddenImport, sourceHasNewDateOutsideClock, sourceHasRequire } from "./source-rules.js";

function collectStructuralFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (sourceHasExportStar(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use export *." }));
  }
  if (sourceHasDynamicImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use dynamic import escape paths." }));
  }
  if (sourceHasRequire(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not use require escape paths." }));
  }
  for (const token of FORBIDDEN_TEXT_TOKENS) {
    if (sourceText.includes(token)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: relativePath, line: 1, severity: "fatal", message: `Nerve Bus contains forbidden token ${token}.` }));
    }
  }
  return findings;
}

function collectBoundaryFindings(relativePath: string, sourceText: string, sourceFile: Parameters<typeof sourceHasExportStar>[0]): Finding[] {
  const findings: Finding[] = [];
  if (relativePath !== PATHS.RUNNER && relativePath !== PATHS.CLOCK_PORT && sourceHasNewDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must source time from the clock port and runtime context only." }));
  }
  if (sourceHasForbiddenImport(sourceFile)) {
    findings.push(createFinding({ lawId: LAW_IDS.BOUNDARY, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not import forbidden capability internals." }));
  }
  return sourceText.includes('startsWith("Transport timed out")') && sourceText.includes('"missing_handler"')
    ? findings.concat(createFinding({ lawId: LAW_IDS.SHAPE, file: relativePath, line: 1, severity: "fatal", message: "Nerve Bus must not classify timeout as missing_handler." }))
    : findings;
}

export function runForbiddenShapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings: Finding[] = [];
  for (const sourceFile of getNerveBusSourceFiles(project)) {
    const relativePath = toRepoPath(sourceFile, project);
    const fullText = sourceFile.getFullText();
    findings.push(...collectStructuralFindings(relativePath, fullText, sourceFile));
    findings.push(...collectBoundaryFindings(relativePath, fullText, sourceFile));
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