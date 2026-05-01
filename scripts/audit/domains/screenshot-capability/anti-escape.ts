import type { Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { LAW_IDS, PATHS } from "./config.js";
import { getRepoPath, getScreenshotSources, getSource } from "./project-access.js";
import { hasDateOutsideClock, hasForbiddenEscape } from "./source-rules.js";

function collectRootEscapeFindings(project: Project): Finding[] {
  const escapeFile = getScreenshotSources(project).find((sourceFile) => hasForbiddenEscape(sourceFile) || hasDateOutsideClock(sourceFile));
  return escapeFile
    ? [createFinding({ lawId: LAW_IDS.SHAPE, file: getRepoPath(escapeFile), line: 1, severity: "fatal", message: "Screenshot root must stay closed to any-casts, suppression comments, dynamic import, require, and scattered time sources." })]
    : [];
}

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSource(project, PATHS.EXECUTOR);
  for (const calleeName of ["runScreenshotPayloadBudgetGate", "runScreenshotOutputBoundaryGate", "buildScreenshotRuntimeProof", "buildScreenshotResult"]) {
    if (!hasCallExpression(executorSource, calleeName)) {
      findings.push(createFinding({ lawId: LAW_IDS.SHAPE, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Screenshot executor must not bypass ${calleeName}.` }));
    }
  }
  return findings;
}

function collectCaptureRunnerFindings(project: Project): Finding[] {
  const captureRunnerSource = getSource(project, PATHS.CAPTURE_RUNNER);
  const captureRunnerText = captureRunnerSource.getFullText();
  return !captureRunnerText.includes("AbortController") || !captureRunnerText.includes("abortSignal")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.CAPTURE_RUNNER, line: 1, severity: "fatal", message: "Screenshot capture runner must preserve real abort-signal wiring for timeouts." })]
    : [];
}

function collectSchemaFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, PATHS.SCHEMA);
  return !hasLiteralTextFragment(schemaSource, "success proof requires outputRef")
    || !hasLiteralTextFragment(schemaSource, "non-success proof must not expose outputRef")
    || !hasLiteralTextFragment(schemaSource, "non-success result must not expose output")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Screenshot schema anti-escape rules for output and outputRef are missing." })]
    : [];
}

function collectOutputBoundaryFindings(project: Project): Finding[] {
  const outputBoundarySource = getSource(project, PATHS.OUTPUT_BOUNDARY_GATE);
  return !hasLiteralTextFragment(outputBoundarySource, "ai_input_mapping_required")
    || !hasLiteralTextFragment(outputBoundarySource, "transformed_output_source_evidence_required")
    ? [createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.OUTPUT_BOUNDARY_GATE, line: 1, severity: "fatal", message: "Screenshot output-boundary gate must retain scaleMapping and sourceScreenshotEvidenceId authority checks." })]
    : [];
}

export function runAntiEscape(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectRootEscapeFindings(project),
    ...collectExecutorFindings(project),
    ...collectCaptureRunnerFindings(project),
    ...collectSchemaFindings(project),
    ...collectOutputBoundaryFindings(project),
  ];

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