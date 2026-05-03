import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  FORBIDDEN_DEBUG_LEAK_TOKENS,
  FORBIDDEN_PROOF_LEAK_PATTERNS,
  FORBIDDEN_RESULT_FIELD_TOKENS,
  FORBIDDEN_TEXT_TOKENS,
  LAW_IDS,
  PATHS,
} from "./config.js";
import { getSourceFile, getTextInputSourceFiles, makeProject, toRepoPath } from "./project-access.js";
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
    findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: relativePath, line: 1, severity: "fatal", message: "executionPort.execute must not appear outside primitive-text-input-runner." }));
  }
  return sourceHasForbiddenImport(sourceFile)
    ? findings.concat(createFinding({ lawId: LAW_IDS.PUBLIC, file: relativePath, line: 1, severity: "fatal", message: "Text Input must not import forbidden ability or browser internals." }))
    : findings;
}

function collectBusinessResultFieldFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const combinedText = [
    getSourceFile(project, PATHS.SCHEMA)?.getFullText() ?? "",
    getSourceFile(project, PATHS.RESULT_BUILDER)?.getFullText() ?? "",
    getSourceFile(project, PATHS.RESULT_SUPPORT)?.getFullText() ?? "",
  ].join("\n");

  for (const token of FORBIDDEN_RESULT_FIELD_TOKENS) {
    if (combinedText.includes(token)) {
      findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Text Input must not expose forbidden business result field ${token}.` }));
    }
  }
  return findings;
}

function collectSensitiveLeakFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const proofText = getSourceFile(project, PATHS.PROOF_BUILDER)?.getFullText() ?? "";
  const resultSupportText = getSourceFile(project, PATHS.RESULT_SUPPORT)?.getFullText() ?? "";
  const debugText = getSourceFile(project, PATHS.DEBUG_EVENTS)?.getFullText() ?? "";

  for (const pattern of FORBIDDEN_PROOF_LEAK_PATTERNS) {
    if (proofText.includes(pattern) || resultSupportText.includes(pattern)) {
      findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Text Input proof/result builders must not persist raw text or fabricate runId." }));
    }
  }
  for (const token of FORBIDDEN_DEBUG_LEAK_TOKENS) {
    if (debugText.includes(token)) {
      findings.push(createFinding({ lawId: LAW_IDS.SENSITIVE, file: PATHS.DEBUG_EVENTS, line: 1, severity: "fatal", message: "Text Input debug material must not expose raw sensitive text or clipboard plaintext." }));
    }
  }
  return findings;
}

export function runForbiddenShapeAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  for (const sourceFile of getTextInputSourceFiles(project)) {
    const relativePath = toRepoPath(sourceFile);
    const fullText = sourceFile.getFullText();
    findings.push(...collectStructuralFindings(relativePath, fullText, sourceFile));
    findings.push(...collectExecutionFindings(relativePath, sourceFile));
  }

  findings.push(...collectBusinessResultFieldFindings(project));
  findings.push(...collectSensitiveLeakFindings(project));

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "forbidden-shape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Text Input avoids escape hatches, forbidden result claims, raw text leaks, and primitive bypass paths."
        : "Text Input still contains forbidden execution shapes or sensitive persistence leaks.",
    ),
  };
}