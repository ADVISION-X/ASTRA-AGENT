import { SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject } from "./project-access.js";

function hasComputedScrollEscape(sourceText: string): boolean {
  return sourceText.includes("[\"scroll\"]") || sourceText.includes("['scroll']");
}

function hasVariableDeclaration(sourceTextSource: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceTextSource?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function functionHasVariableDeclaration(
  sourceTextSource: ReturnType<typeof getSourceFile>,
  functionName: string,
  variableName: string,
): boolean {
  return sourceTextSource?.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function collectExecutorFindings(executorSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!executorSource) {
    return [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor is missing for anti-escape checks." })];
  }

  const project = makeProject();
  const validatorSource = getSourceFile(project, PATHS.EXECUTION_VALIDATOR);
  const reservationSource = getSourceFile(project, PATHS.EXECUTION_RESERVATION);
  const resultSources = [
    executorSource,
    validatorSource,
    reservationSource,
    getSourceFile(project, PATHS.BLOCKED_RESULT_BUILDER),
    getSourceFile(project, PATHS.PRIMITIVE_RESULT_BUILDER),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);

  const findings: Finding[] = [];
  for (const variableName of ["geometryGate", "policyGate", "safetyGate", "deltaResolution"]) {
    if (!functionHasVariableDeclaration(validatorSource, "validateMouseScrollExecution", variableName)) {
      findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTION_VALIDATOR, line: 1, severity: "fatal", message: `Mouse Scroll validator must keep ${variableName} as a governed checkpoint.` }));
    }
  }
  if (!functionHasVariableDeclaration(reservationSource, "reserveMouseScrollExecution", "reservation")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTION_RESERVATION, line: 1, severity: "fatal", message: "Mouse Scroll reservation stage must keep reservation as a governed checkpoint." }));
  }
  if (!functionHasVariableDeclaration(reservationSource, "runReservedMouseScrollExecution", "primitiveResult")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTION_RESERVATION, line: 1, severity: "fatal", message: "Mouse Scroll reservation stage must keep primitiveResult as a governed checkpoint." }));
  }

  const returnsResultBuilder = resultSources.some((sourceFile) => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "buildMouseScrollResult"));
  return returnsResultBuilder
    ? findings
    : [...findings, createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor chain must terminate through buildMouseScrollResult." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !resultBuilderSource || !hasVariableDeclaration(resultBuilderSource, "runtimeProof")
    ? [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll result builder must preserve the proof builder output." })]
    : [];
}

function collectAbortControllerFindings(iterationSource: ReturnType<typeof getSourceFile>): Finding[] {
  return !iterationSource || !iterationSource.getFullText().includes("AbortController")
    ? [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must allocate AbortController." })]
    : [];
}

function collectPortCallFindings(portCallSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!portCallSource) {
    return [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER_PORT_CALL, line: 1, severity: "fatal", message: "Mouse Scroll primitive timeout port-call stage is missing." })];
  }

  const fullText = portCallSource.getFullText();
  const findings: Finding[] = [];
  if (!fullText.includes("setTimeout(")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER_PORT_CALL, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must arm a timeout timer before calling the primitive port." }));
  }
  if (!fullText.includes("abortController.abort")) {
    findings.push(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER_PORT_CALL, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must abort timed-out primitive calls." }));
  }
  return hasComputedScrollEscape(fullText)
    ? findings.concat(createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER_PORT_CALL, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must not hide scroll execution behind computed property access." }))
    : findings;
}

function collectConcurrencyFindings(
  runnerGuardSource: ReturnType<typeof getSourceFile>,
  runnerStateSource: ReturnType<typeof getSourceFile>,
): Finding[] {
  return !runnerGuardSource || !runnerStateSource || !hasVariableDeclaration(runnerStateSource, "MAX_CONCURRENT_SCROLLS") || !runnerGuardSource.getFullText().includes("isPrimitiveConcurrencyBlocked")
    ? [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner must enforce max concurrent scrolls." })]
    : [];
}

function collectRunnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const runnerSource = getSourceFile(project, PATHS.RUNNER);
  const iterationSource = getSourceFile(project, PATHS.RUNNER_ITERATION);
  const portCallSource = getSourceFile(project, PATHS.RUNNER_PORT_CALL);
  const runnerGuardSource = getSourceFile(project, PATHS.RUNNER_GUARD);
  const runnerStateSource = getSourceFile(project, PATHS.RUNNER_STATE);
  if (!runnerSource) {
    return [createFinding({ lawId: LAW_IDS.TIMING, file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Scroll primitive runner is missing for anti-escape checks." })];
  }

  return [
    ...collectAbortControllerFindings(iterationSource),
    ...collectPortCallFindings(portCallSource),
    ...collectConcurrencyFindings(runnerGuardSource, runnerStateSource),
  ];
}

export function runAntiEscapeAttack(): { findings: Finding[]; phase: InspectorPhase } {
  const project = makeProject();
  const findings = [
    ...collectExecutorFindings(getSourceFile(project, PATHS.EXECUTOR)),
    ...collectResultBuilderFindings(getSourceFile(project, PATHS.RESULT_BUILDER)),
    ...collectRunnerFindings(project),
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