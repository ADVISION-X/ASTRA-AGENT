import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasCallExpression, hasLiteralTextFragment } from "../_shared/ast-helpers.js";
import { getRepoPath, getScreenshotSources, getSource, hasDateOutsideClock, hasForbiddenEscape, ROOT } from "./ast-utils.js";

export function runAntiEscape(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];

  const escapeFile = getScreenshotSources(project).find((sourceFile) => hasForbiddenEscape(sourceFile) || hasDateOutsideClock(sourceFile));
  if (escapeFile) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
      file: getRepoPath(escapeFile),
      line: 1,
      severity: "fatal",
      message: "Screenshot root must stay closed to any-casts, suppression comments, dynamic import, require, and scattered time sources.",
    }));
  }

  const executorSource = getSource(project, `${ROOT}/runtime/screenshot-executor.ts`);
  for (const calleeName of [
    "runScreenshotPayloadBudgetGate",
    "runScreenshotOutputBoundaryGate",
    "buildScreenshotRuntimeProof",
    "buildScreenshotResult",
  ]) {
    if (!hasCallExpression(executorSource, calleeName)) {
      findings.push(createFinding({
        lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-004-V1",
        file: `${ROOT}/runtime/screenshot-executor.ts`,
        line: 1,
        severity: "fatal",
        message: `Screenshot executor must not bypass ${calleeName}.`,
      }));
    }
  }

  const captureRunnerSource = getSource(project, `${ROOT}/runtime/capture-runner.ts`);
  const captureRunnerText = captureRunnerSource.getFullText();
  if (!captureRunnerText.includes("AbortController") || !captureRunnerText.includes("abortSignal")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/runtime/capture-runner.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot capture runner must preserve real abort-signal wiring for timeouts.",
    }));
  }

  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  if (!hasLiteralTextFragment(schemaSource, "success proof requires outputRef")
    || !hasLiteralTextFragment(schemaSource, "non-success proof must not expose outputRef")
    || !hasLiteralTextFragment(schemaSource, "non-success result must not expose output")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/schema.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot schema anti-escape rules for output and outputRef are missing.",
    }));
  }

  const outputBoundarySource = getSource(project, `${ROOT}/runtime/screenshot-output-boundary-gate.ts`);
  if (!hasLiteralTextFragment(outputBoundarySource, "ai_input_mapping_required")
    || !hasLiteralTextFragment(outputBoundarySource, "transformed_output_source_evidence_required")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-003-V1",
      file: `${ROOT}/runtime/screenshot-output-boundary-gate.ts`,
      line: 1,
      severity: "fatal",
      message: "Screenshot output-boundary gate must retain scaleMapping and sourceScreenshotEvidenceId authority checks.",
    }));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Screenshot anti-escape checks are closed over payload, output boundary, abort, and proof rules."
        : "Screenshot still allows one or more anti-escape bypasses.",
    ),
  };
}