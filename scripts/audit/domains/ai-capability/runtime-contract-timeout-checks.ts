import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const hasExecuteSignalOption = (sourceFile: SourceFile): boolean => {
  const executeMethod = sourceFile.getInterface("AiRuntimePort")?.getMethod("execute");
  const optionTypeText = executeMethod?.getParameters()[1]?.getTypeNode()?.getText() ?? "";
  if (optionTypeText.includes("signal")) {
    return true;
  }

  const executeOptions = sourceFile.getTypeAlias("AiRuntimeExecuteOptions");
  return executeOptions?.getTypeNode()?.getText().includes("signal") === true;
};

const hasRuntimeSignalPropagation = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
    if (expression.getExpression().getText() !== "input.context.runtime.execute") {
      return false;
    }

    const signalArgument = expression.getArguments()[1];
    return Node.isObjectLiteralExpression(signalArgument)
      && signalArgument.getProperty("signal")?.getText().includes("signal") === true;
  });
};

const hasAbortControllerTimeout = (sourceFile: SourceFile): boolean => {
  const hasAbortController = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "AbortController");
  return hasAbortController && sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getText() === "controller.abort");
};

const hasPromiseRaceTimeout = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getText() === "Promise.race");

const importsModule = (sourceFile: SourceFile, moduleSpecifier: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);

const hasForbiddenModuleState = (sourceFile: SourceFile, variableName: string): boolean =>
  sourceFile.getVariableDeclaration(variableName)?.getFirstAncestorByKind(SyntaxKind.SourceFile) === sourceFile;

const findRuntimePortTimeoutViolations = (sourceFile: SourceFile): Finding[] => {
  if (hasExecuteSignalOption(sourceFile)) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/ports/ai-runtime-port.ts`, line: 1, severity: "fatal", message: "AI runtime port execute must accept a governed signal option." })];
};

const findRuntimeCallRunnerViolations = (sourceFile: SourceFile): Finding[] => {
  if (hasAbortControllerTimeout(sourceFile) && hasRuntimeSignalPropagation(sourceFile)) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`, line: 1, severity: "fatal", message: "AI runtime call runner must create AbortController timeout and pass controller.signal into runtime.execute." })];
};

const findLocalGatewayTimeoutViolations = (sourceFile: SourceFile): Finding[] => {
  if (hasAbortControllerTimeout(sourceFile) && hasPromiseRaceTimeout(sourceFile)) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`, line: 1, severity: "fatal", message: "Local AI timeout guard must combine AbortController cancellation with a hard Promise.race timeout so late runtime success is discarded." })];
};

const findTimeoutPolicyViolations = (sourceFile: SourceFile): Finding[] => {
  if (importsModule(sourceFile, "./local-ai-runtime-policy.js") && hasCallExpression(sourceFile, "resolveAiRuntimeTimeoutMs")) {
    return [];
  }

  return [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime/ai-timeout-policy-gate.ts`, line: 1, severity: "fatal", message: "AI timeout policy gate must resolve task timeouts from the governed local runtime policy module." })];
};

const findLocalAdapterPolicyViolations = (sourceFile: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  if (!importsModule(sourceFile, "../runtime/local-ai-runtime-policy.js")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI runtime adapter must read concurrency and circuit-breaker limits from the governed local runtime policy module." }));
  }
  if (hasForbiddenModuleState(sourceFile, "activeRuns") || hasForbiddenModuleState(sourceFile, "circuitBreaker")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI runtime adapter must not keep activeRuns or circuitBreaker as module-level mutable state." }));
  }
  return findings;
};

export const findTimeoutCancellationViolations = (project: Project): Finding[] => {
  const runtimePortSource = getSourceOrThrow(project, `${AI_ROOT}/ports/ai-runtime-port.ts`);
  const runtimeCallRunnerSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`);
  const timeoutPolicySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-timeout-policy-gate.ts`);
  const localGatewaySource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`);
  const localAdapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  return [
    ...findRuntimePortTimeoutViolations(runtimePortSource),
    ...findRuntimeCallRunnerViolations(runtimeCallRunnerSource),
    ...findLocalGatewayTimeoutViolations(localGatewaySource),
    ...findTimeoutPolicyViolations(timeoutPolicySource),
    ...findLocalAdapterPolicyViolations(localAdapterSource),
  ];
};
