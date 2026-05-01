import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

function hasComputedScrollEscape(sourceText: string): boolean {
  return sourceText.includes("[\"scroll\"]") || sourceText.includes("['scroll']");
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  for (const variableName of ["geometryGate", "policyGate", "safetyGate", "deltaResolution", "reservation", "primitiveResult"]) {
    if (!executorSource.getVariableDeclaration(variableName)) {
      findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Scroll executor must keep ${variableName} as a governed checkpoint.` }));
    }
  }

  const returnsResultBuilder = executorSource.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
    const expression = statement.getExpression();
    return expression !== undefined && Node.isCallExpression(expression) && expression.getExpression().getText() === "buildMouseScrollResult";
  });
  return returnsResultBuilder
    ? findings
    : [...findings, createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor must return buildMouseScrollResult directly." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !resultBuilderSource || resultBuilderSource.getVariableDeclaration("runtimeProof") === undefined
    ? [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll result builder must preserve the proof builder output." })]
    : [];
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const fullText = runnerSource.getFullText();
  if (!fullText.includes("Promise.race")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must use Promise.race for hard timeout enforcement." }));
  }
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must allocate AbortController." }));
  }
  if (!fullText.includes("MAX_CONCURRENT_SCROLLS")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must enforce max concurrent scrolls." }));
  }
  if (hasComputedScrollEscape(fullText)) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must not hide scroll execution behind computed property access." }));
  }
  return findings;
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectExecutorFindings(getSourceFile(project, PATHS.EXECUTOR)),
    ...collectResultBuilderFindings(getSourceFile(project, PATHS.RESULT_BUILDER)),
    ...collectRunnerFindings(getSourceFile(project, PATHS.RUNNER)),
  ];

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll resists gate bypass, proof dropping, and primitive wrapper escape patterns."
        : "Mouse Scroll still exposes anti-escape gaps in the governed chain.",
    ),
  };
}