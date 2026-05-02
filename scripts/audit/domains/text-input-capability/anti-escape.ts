import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

function hasVariableDeclaration(sourceFile: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceFile?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function hasIdentifier(sourceFile: ReturnType<typeof getSourceFile>, identifierName: string): boolean {
  return sourceFile?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === identifierName) ?? false;
}

function getExecutorRouteSources(project: ReturnType<typeof makeProject>) {
  return [
    getSourceFile(project, PATHS.EXECUTOR),
    getSourceFile(project, PATHS.EXECUTION_GATES),
    getSourceFile(project, PATHS.EXECUTOR_FLOW),
    getSourceFile(project, PATHS.EXECUTOR_PLAN),
    getSourceFile(project, PATHS.EXECUTOR_FINALIZE),
    getSourceFile(project, PATHS.EXECUTION_SUPPORT),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
}

function collectVariableCheckpointFindings(routeSources: ReturnType<typeof getExecutorRouteSources>): Finding[] {
  const findings: Finding[] = [];
  const gateVariables = ["targetGate", "focusGate", "sourceGate", "approvedTextGate", "sensitiveGate", "keyGate", "commitGate", "clipboardGate", "executionResult"];
  for (const variableName of gateVariables) {
    if (!routeSources.some((sourceFile) => hasVariableDeclaration(sourceFile, variableName))) {
      findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Text Input executor must keep ${variableName} as a governed checkpoint.` }));
    }
  }

  return findings;
}

function collectPolicyAndActionRefFindings(routeSources: ReturnType<typeof getExecutorRouteSources>): Finding[] {
  const findings: Finding[] = [];
  if (!routeSources.some((sourceFile) => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "validateTextPolicy"))) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor must keep textPolicyGate as a governed checkpoint." }));
  }

  if (!routeSources.some((sourceFile) => hasIdentifier(sourceFile, "actionExecutionRef"))) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor must keep actionExecutionRef as a governed checkpoint." }));
  }

  return findings;
}

function hasGovernedResultBuilderCall(routeSources: ReturnType<typeof getExecutorRouteSources>): boolean {
  return routeSources.some((sourceFile) => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const calleeText = callExpression.getExpression().getText();
    return calleeText === "buildTextInputExecutionResult" || calleeText === "buildTextInputResult";
  }));
}

function collectFinalizeMergeFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const finalizeSource = getSourceFile(project, PATHS.EXECUTOR_FINALIZE);
  const finalizeText = finalizeSource?.getFullText() ?? "";
  if (!finalizeText.includes("input.executionResult.state.clipboardDecision = input.state.clipboardDecision;")
    || !finalizeText.includes("input.executionResult.state.restoredClipboardHash = input.state.restoredClipboardHash;")
    || !finalizeText.includes("input.executionResult.state.dataQualityFlags = mergeFlags(input.executionResult.state.dataQualityFlags, input.state.dataQualityFlags);")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor must merge clipboard restore outcome and state flags into the final governed result envelope." }));
  }

  return findings;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const routeSources = getExecutorRouteSources(project);
  if (routeSources.length === 0) {
    return [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor is missing for anti-escape checks." })];
  }

  const findings = [
    ...collectVariableCheckpointFindings(routeSources),
    ...collectPolicyAndActionRefFindings(routeSources),
    ...collectFinalizeMergeFindings(project),
  ];
  if (!hasGovernedResultBuilderCall(routeSources)) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Text Input executor must terminate through the governed result builder chain." }));
  }

  return findings;
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!resultBuilderSource) {
    return [createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  if (!hasVariableDeclaration(resultBuilderSource, "runtimeProof")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder must preserve the proof builder output." }));
  }
  if (!hasVariableDeclaration(resultBuilderSource, "outputBoundary") || !hasVariableDeclaration(resultBuilderSource, "debugBundle")) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Text Input result builder must preserve output boundary and debug bundle checkpoints." }));
  }
  return findings;
}

function collectRunnerFindings(runnerSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!runnerSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Text Input primitive runner is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const fullText = runnerSource.getFullText();
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Text Input primitive runner must own AbortController." }));
  }
  if (!fullText.includes("Promise.race")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Text Input primitive runner must use Promise.race for timeout and abort enforcement." }));
  }
  if (!fullText.includes("text input primitive timed out")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Text Input primitive runner must preserve hard timeout enforcement." }));
  }
  if (fullText.includes("[\"execute\"]") || fullText.includes("['execute']")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Text Input primitive runner must not hide execution behind computed property access." }));
  }
  return findings;
}

export function runAntiEscapeAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectExecutorFindings(project),
    ...collectResultBuilderFindings(getSourceFile(project, PATHS.RESULT_BUILDER)),
    ...collectRunnerFindings(getSourceFile(project, PATHS.RUNNER)),
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