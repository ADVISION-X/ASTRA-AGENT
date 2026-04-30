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

function hasVariableDeclaration(sourceFile: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceFile?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Text Input executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const gateVariables = ["targetGate", "focusGate", "sourceGate", "approvedTextGate", "textPolicyGate", "sensitiveGate", "keyGate", "commitGate", "clipboardGate", "actionExecutionRef", "finalResultInput"];
  for (const variableName of gateVariables) {
    if (!hasVariableDeclaration(executorSource, variableName)) {
      findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: `Text Input executor must keep ${variableName} as a governed checkpoint.` }));
    }
  }

  const returnsResultBuilder = executorSource.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
    const expression = statement.getExpression();
    return expression !== undefined && Node.isCallExpression(expression) && expression.getExpression().getText() === "buildTextInputResult";
  });
  if (!returnsResultBuilder) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Text Input executor must return buildTextInputResult directly." }));
  }

  const executorText = executorSource.getFullText();
  if (!executorText.includes("finalResultInput.clipboardDecision = state.clipboardDecision;")
    || !executorText.includes("finalResultInput.restoredClipboardHash = state.restoredClipboardHash;")
    || !executorText.includes("finalResultInput.dataQualityFlags = mergeFlags(finalResultInput.dataQualityFlags, state.dataQualityFlags);")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Text Input executor must merge clipboard restore outcome and state flags into the final governed result envelope." }));
  }

  return findings;
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!resultBuilderSource) {
    return [createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Text Input result builder is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  if (!hasVariableDeclaration(resultBuilderSource, "runtimeProof")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Text Input result builder must preserve the proof builder output." }));
  }
  if (!hasVariableDeclaration(resultBuilderSource, "outputBoundary") || !hasVariableDeclaration(resultBuilderSource, "debugBundle")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-006-V1", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Text Input result builder must preserve output boundary and debug bundle checkpoints." }));
  }
  return findings;
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Text Input primitive runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const fullText = runnerSource.getFullText();
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Text Input primitive runner must own AbortController." }));
  }
  if (!fullText.includes("Promise.race")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Text Input primitive runner must use Promise.race for timeout and abort enforcement." }));
  }
  if (!fullText.includes("text input primitive timed out")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Text Input primitive runner must preserve hard timeout enforcement." }));
  }
  if (fullText.includes("[\"execute\"]") || fullText.includes("['execute']")) {
    findings.push(createFinding({ lawId: "GRASSEYE-TEXT-INPUT-CAPABILITY-005-V1", file: RUNNER_PATH, line: 1, severity: "fatal", message: "Text Input primitive runner must not hide execution behind computed property access." }));
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
        ? "Text Input resists gate bypass, proof dropping, and primitive adapter escape patterns."
        : "Text Input still exposes anti-escape gaps in the governed chain.",
    ),
  };
}