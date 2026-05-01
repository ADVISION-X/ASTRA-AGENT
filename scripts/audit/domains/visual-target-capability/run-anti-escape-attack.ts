import type { Project } from "ts-morph";

import { hasAnyKeyword } from "./inspection-ast-helpers.js";
import { createAttackPhase, createViolation, toLine, toRootRelative, type AttackOutcome } from "./inspection-helpers.js";
import { canUseDateInFile, getCommentEscapeMarkers, getDynamicImportEscapes, getIllegalDateNodes, getRequireEscapes, getUnknownCastEscapes } from "./inspection-escape-helpers.js";
import { getVisualTargetSourceFiles } from "./inspection-source-helpers.js";

const collectSourceEscapeFindings = (sourceFile: import("ts-morph").SourceFile) => {
  const findings = [];
  const relativePath = toRootRelative(sourceFile);
  if (hasAnyKeyword(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use any." }));
  }
  for (const node of getUnknownCastEscapes(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use as any or as unknown as escape casts." }));
  }
  for (const node of getDynamicImportEscapes(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use dynamic import escapes." }));
  }
  for (const node of getRequireEscapes(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use require escapes." }));
  }
  for (const marker of getCommentEscapeMarkers(sourceFile)) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, severity: "fatal", message: `Visual Target must not include ${marker}.` }));
  }
  if (!canUseDateInFile(relativePath)) {
    for (const node of getIllegalDateNodes(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not scatter new Date or Date.parse outside the dedicated clock/time helpers." }));
    }
  }
  return findings;
};

export async function runAntiEscapeAttack(project: Project): Promise<AttackOutcome> {
  const findings = getVisualTargetSourceFiles(project).flatMap((sourceFile) => collectSourceEscapeFindings(sourceFile));

  return { findings, phase: createAttackPhase("anti-escape-attack", findings, "Visual Target anti-escape guard is clean: no any, no double-cast escapes, no dynamic loading, and no scattered Date parsing.", "Visual Target anti-escape guard detected type escapes, comment suppressions, dynamic loading, or scattered Date parsing.") };
}