import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  EXECUTOR_PATH,
  RESULT_BUILDER_PATH,
  RUNNER_PATH,
  getSourceFile,
  makeProject,
} from "./ast-utils.js";

function hasComputedScrollEscape(sourceText: string): boolean {
  return sourceText.includes("[\"scroll\"]") || sourceText.includes("['scroll']");
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const runnerSource = getSourceFile(project, RUNNER_PATH);

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Scroll executor is missing for anti-escape checks." }));
  } else {
    for (const variableName of ["geometryGate", "policyGate", "safetyGate", "deltaResolution", "reservation", "primitiveResult"]) {
      if (!executorSource.getVariableDeclaration(variableName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Mouse Scroll executor must keep ${variableName} as a governed checkpoint.` }));
      }
    }

    const returnsResultBuilder = executorSource.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
      const expression = statement.getExpression();
      return expression !== undefined && Node.isCallExpression(expression) && expression.getExpression().getText() === "buildMouseScrollResult";
    });
    if (!returnsResultBuilder) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Scroll executor must return buildMouseScrollResult directly." }));
    }
  }

  if (!resultBuilderSource || resultBuilderSource.getVariableDeclaration("runtimeProof") === undefined) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll result builder must preserve the proof builder output." }));
  }

  if (!runnerSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner is missing for anti-escape checks." }));
  } else {
    const fullText = runnerSource.getFullText();
    if (!fullText.includes("Promise.race")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must use Promise.race for hard timeout enforcement." }));
    }
    if (!fullText.includes("AbortController")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must allocate AbortController." }));
    }
    if (!fullText.includes("MAX_CONCURRENT_SCROLLS")) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must enforce max concurrent scrolls." }));
    }
    if (hasComputedScrollEscape(fullText)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-SCROLL-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must not hide scroll execution behind computed property access." }));
    }
  }

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