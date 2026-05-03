import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getSourceFile, makeProject } from "./audit-project.js";
import { PATHS } from "./config.js";

function hasComputedClickEscape(source: ReturnType<typeof getSourceFile>): boolean {
  return source?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isElementAccessExpression(expression)
      && expression.getArgumentExpression()?.getText().replaceAll("\"", "").replaceAll("'", "") === "click";
  }) ?? false;
}

function hasVariableDeclaration(sourceTextSource: ReturnType<typeof getSourceFile>, variableName: string): boolean {
  return sourceTextSource?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => declaration.getName() === variableName) ?? false;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  const preflightSource = getSourceFile(project, PATHS.PREFLIGHT_STAGES);
  const primitiveStageSource = getSourceFile(project, PATHS.PRIMITIVE_STAGE);
  const routeSources = [executorSource, preflightSource, primitiveStageSource].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);
  if (routeSources.length === 0) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Click executor is missing for anti-escape checks." })];
  }

  const findings: Finding[] = [];
  const gateVariables = ["geometryGate", "policyGate", "boundaryGate", "safetyGate", "reservation", "primitiveResult"];
  for (const variableName of gateVariables) {
    if (!routeSources.some((sourceFile) => hasVariableDeclaration(sourceFile, variableName))) {
      findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Click executor must keep ${variableName} as a governed checkpoint.` }));
    }
  }

  const returnsResultBuilder = routeSources.some((sourceFile) => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getText() === "buildMouseClickResult"));
  return returnsResultBuilder
    ? findings
    : [...findings, createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2", file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Click executor must terminate through buildMouseClickResult." })];
}

function collectResultBuilderFindings(resultBuilderSource: ReturnType<typeof getSourceFile>): Finding[] {
  if (!resultBuilderSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder is missing for anti-escape checks." })];
  }

  return hasVariableDeclaration(resultBuilderSource, "runtimeProof")
    ? []
    : [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-004-V2", file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Click result builder must preserve the proof builder output." })];
}

function getRunnerSources(project: ReturnType<typeof makeProject>) {
  const runnerSource = getSourceFile(project, PATHS.RUNNER);
  return {
    runnerSource,
    runnerGuardSource: getSourceFile(project, PATHS.RUNNER_GUARD),
    runnerStateSource: getSourceFile(project, PATHS.RUNNER_STATE),
  };
}

function collectRunnerTimeoutFindings(runnerSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  const fullText = runnerSource.getFullText();
  const findings: Finding[] = [];
  if (!fullText.includes("Promise.race")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner must use Promise.race for hard timeout enforcement." }));
  }
  if (!fullText.includes("AbortController")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner must allocate AbortController." }));
  }
  if (!fullText.includes("abortSignal: abortController.signal")) {
    findings.push(createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner must pass AbortSignal through MouseClickPrimitivePort." }));
  }
  return findings;
}

function collectRunnerConcurrencyFindings(input: {
  runnerGuardSource: ReturnType<typeof getSourceFile>;
  runnerStateSource: ReturnType<typeof getSourceFile>;
}): Finding[] {
  return !input.runnerGuardSource || !input.runnerStateSource || !hasVariableDeclaration(input.runnerStateSource, "MAX_CONCURRENT_CLICKS") || !input.runnerGuardSource.getFullText().includes("hasPrimitiveExecutionCapacity")
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner must enforce max concurrent clicks." })]
    : [];
}

function collectRunnerComputedAccessFindings(runnerSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return hasComputedClickEscape(runnerSource)
    ? [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner must not hide click execution behind computed property access." })]
    : [];
}

function collectRunnerFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const { runnerSource, runnerGuardSource, runnerStateSource } = getRunnerSources(project);
  if (!runnerSource) {
    return [createFinding({ lawId: "GRASSEYE-MOUSE-CLICK-CAPABILITY-007-V2", file: PATHS.RUNNER, line: 1, severity: "fatal", message: "Mouse Click primitive runner is missing for anti-escape checks." })];
  }

  return [
    ...collectRunnerTimeoutFindings(runnerSource),
    ...collectRunnerConcurrencyFindings({ runnerGuardSource, runnerStateSource }),
    ...collectRunnerComputedAccessFindings(runnerSource),
  ];
}

export function runAntiEscapeAttack(project: ReturnType<typeof makeProject> = makeProject()): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectExecutorFindings(project),
    ...collectResultBuilderFindings(getSourceFile(project, PATHS.RESULT_BUILDER)),
    ...collectRunnerFindings(project),
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
