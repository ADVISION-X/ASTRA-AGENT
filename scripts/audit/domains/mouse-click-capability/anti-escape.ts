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

function hasComputedClickEscape(sourceText: string): boolean {
  return sourceText.includes("[\"click\"]") || sourceText.includes("['click']");
}

function hasVariableDeclaration(sourceTextSource: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceTextSource?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const gateVariables = ["geometryGate", "policyGate", "boundaryGate", "safetyGate", "reservation", "primitiveResult"];
  for (const variableName of gateVariables) {
    if (!hasVariableDeclaration(executorSource, variableName)) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Mouse Click executor must keep ${variableName} as a governed checkpoint.` }));
    }
  }

  const returnsResultBuilder = executorSource.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
    const expression = statement.getExpression();
    return expression !== undefined && Node.isCallExpression(expression) && expression.getExpression().getText() === "buildMouseClickResult";
  });
  return returnsResultBuilder
    ? findings
    : [...findings, createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor must return buildMouseClickResult directly." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!resultBuilderSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click result builder is missing for anti-escape checks." })];
  }

  return hasVariableDeclaration(resultBuilderSource, "runtimeProof")
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve the proof builder output." })];
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const fullText = runnerSource.getFullText();
  if (!fullText.includes("Promise.race")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner must use Promise.race for hard timeout enforcement." }));
  }
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner must allocate AbortController." }));
  }
  if (!fullText.includes("MAX_CONCURRENT_CLICKS")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner must enforce max concurrent clicks." }));
  }
  if (hasComputedClickEscape(fullText)) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner must not hide click execution behind computed property access." }));
  }
  return findings;
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectExecutorFindings(getSourceFile(project, EXECUTOR_PATH)),
    ...collectResultBuilderFindings(getSourceFile(project, RESULT_BUILDER_PATH)),
    ...collectRunnerFindings(getSourceFile(project, RUNNER_PATH)),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "anti-escape",
      phasePassed ? "PASS" : "CODE VIOLATION",
      phasePassed,
      phasePassed
        ? "Mouse Click resists gate bypass, proof dropping, and primitive wrapper escape patterns."
        : "Mouse Click still exposes anti-escape gaps in the governed chain.",
    ),
  };
}
