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

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const findings: Finding[] = [];
  const project = makeProject();
  const executorSource = getSourceFile(project, EXECUTOR_PATH);
  const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
  const runnerSource = getSourceFile(project, RUNNER_PATH);

  if (!executorSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor is missing for anti-escape checks." }));
  } else {
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
    if (!returnsResultBuilder) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Mouse Click executor must return buildMouseClickResult directly." }));
    }
  }

  if (!resultBuilderSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click result builder is missing for anti-escape checks." }));
  } else {
    const hasProofVariable = hasVariableDeclaration(resultBuilderSource, "runtimeProof");
    if (!hasProofVariable) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve the proof builder output." }));
    }
  }

  if (!runnerSource) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Mouse Click primitive runner is missing for anti-escape checks." }));
  } else {
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
  }

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
