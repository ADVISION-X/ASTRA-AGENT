import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT } = aiInspectionConstants;
const { getSourceOrThrow } = aiInspectionUtils;

const REQUIRED_AI_RUNTIME_FAILURE_STATUSES = [
  "runtime_threw",
  "runtime_timeout",
  "runtime_invalid_response",
  "runtime_http_failed",
  "invalid_output",
  "model_missing",
  "engine_missing",
  "service_unreachable",
  "missing_evidence",
  "prompt_contract_rejected",
  "task_type_mismatch",
  "circuit_breaker_open",
  "concurrency_limited",
  "provider_not_configured",
  "provider_secret_missing",
] as const;

const hasStringArrayElements = (sourceFile: SourceFile, values: readonly string[]): boolean => {
  const literals = new Set(sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()));
  return values.every((value) => literals.has(value));
};

const hasFunctionObjectProperty = (sourceFile: SourceFile, functionName: string, propertyName: string): boolean => {
  const functionNode = sourceFile.getFunction(functionName)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  return Boolean(
    functionNode?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName)
    || functionNode?.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment).some((property) => property.getName() === propertyName),
  );
};

const hasTypeAliasProperty = (sourceFile: SourceFile, typeName: string, propertyName: string): boolean => {
  const typeNode = sourceFile.getTypeAlias(typeName)?.getTypeNode();
  return Boolean(typeNode?.getDescendantsOfKind(SyntaxKind.PropertySignature).some((property) => property.getName() === propertyName));
};

const hasFunctionCall = (sourceFile: SourceFile, functionName: string, callName: string): boolean => {
  const functionNode = sourceFile.getFunction(functionName)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  return Boolean(functionNode?.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === callName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === callName;
  }));
};

const hasSourceCall = (sourceFile: SourceFile, callName: string): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === callName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === callName;
  });
};

const getCallStartInFunction = (sourceFile: SourceFile, functionName: string, callName: string): number | null => {
  const functionNode = sourceFile.getFunction(functionName)
    ?? sourceFile.getVariableDeclaration(functionName)?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const callExpression = functionNode?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression)
      ? expression.getText() === callName
      : Node.isPropertyAccessExpression(expression) && expression.getName() === callName;
  });
  return callExpression?.getStart() ?? null;
};

const hasOrderedFunctionCall = (sourceFile: SourceFile, functionName: string, firstCallName: string, secondCallName: string): boolean => {
  const firstStart = getCallStartInFunction(sourceFile, functionName, firstCallName);
  const secondStart = getCallStartInFunction(sourceFile, functionName, secondCallName);
  return firstStart !== null && secondStart !== null && firstStart < secondStart;
};

const collectRuntimeStatusFindings = (project: Project): Finding[] => {
  const runtimeResultSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-runtime-result.ts`);
  return hasStringArrayElements(runtimeResultSource, REQUIRED_AI_RUNTIME_FAILURE_STATUSES)
    ? []
    : [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-runtime-result.ts`, line: 1, severity: "fatal", message: "AI runtime result resolver must preserve specific implementationStatus values instead of collapsing them to runtime_execution_failed or schema_validation_failed." })];
};

const collectDispatchFailureEnvelopeFindings = (project: Project): Finding[] => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const hasDiagnosticEnvelope = hasFunctionObjectProperty(abilityGroupSource, "dispatchAiExecutionFailure", "implementationStatus")
    && hasFunctionObjectProperty(abilityGroupSource, "dispatchAiExecutionFailure", "diagnosticPayloadRef")
    && hasFunctionObjectProperty(abilityGroupSource, "dispatchAiExecutionFailure", "errorKind");
  return hasDiagnosticEnvelope
    ? []
    : [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "Unexpected AI child throws must keep runtime_execution_failed as an outer kind while exposing implementationStatus, errorKind, and diagnosticPayloadRef." })];
};

const collectOuterCatchDebugFindings = (project: Project): Finding[] => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const executionFailureDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-failure-debug.ts`);
  const hasOuterDebug = hasFunctionCall(abilityGroupSource, "executeResolvedAiEntry", "emitAiExecutionFailureDebug")
    && hasFunctionCall(executionFailureDebugSource, "emitAiExecutionFailureDebug", "emitDebugEvent")
    && hasFunctionObjectProperty(executionFailureDebugSource, "buildExecutionFailureDebugRefs", "diagnosticPayloadRef")
    && hasFunctionObjectProperty(executionFailureDebugSource, "buildExecutionFailureDebugRuntime", "diagnosticPayloadRef");
  return hasOuterDebug
    ? []
    : [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-execution-failure-debug.ts`, line: 1, severity: "fatal", message: "Unexpected AI child throws must emit AI_ERROR_DEBUG with diagnosticPayloadRef before returning the governed dispatch failure." })];
};

const hasExecutorPreRuntimeRequestDebug = (project: Project): boolean => {
  const executorSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-executor.ts`);
  const executionRequestDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-request-debug.ts`);
  return hasOrderedFunctionCall(executorSource, "executeAiChild", "emitAiExecutionRequestDebug", "resolveAiPreRuntimeResult")
    && hasFunctionCall(executionRequestDebugSource, "emitAiExecutionRequestDebug", "emitDebugEvent")
    && hasFunctionObjectProperty(executionRequestDebugSource, "buildRequestDebugRuntime", "runtimeCallId")
    && hasFunctionObjectProperty(executionRequestDebugSource, "buildRequestDebugRuntime", "implementationStatus")
    && hasFunctionObjectProperty(executionRequestDebugSource, "buildRequestDebugRuntime", "diagnosticPayloadRef")
    && hasFunctionObjectProperty(executionRequestDebugSource, "buildRequestDebugPrompt", "promptDebugRef");
};

const hasAbilityPreParseRequestDebug = (project: Project): boolean => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const executionInputDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-input-debug.ts`);
  return hasOrderedFunctionCall(abilityGroupSource, "executeAiRequest", "emitAiExecutionInputDebug", "parseAiExecutionInput")
    && hasFunctionCall(executionInputDebugSource, "emitAiExecutionInputDebug", "emitDebugEvent")
    && hasFunctionObjectProperty(executionInputDebugSource, "buildInputDebugRuntime", "implementationStatus")
    && hasFunctionObjectProperty(executionInputDebugSource, "buildInputDebugRuntime", "diagnosticPayloadRef")
    && hasFunctionObjectProperty(executionInputDebugSource, "buildInputDebugPrompt", "promptDebugRef");
};

const hasDebugEmitterRequiredBeforeExecution = (project: Project): boolean => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const missingEmitterStart = getCallStartInFunction(abilityGroupSource, "executeAiRequest", "dispatchAiDebugEmitterMissing");
  const inputDebugStart = getCallStartInFunction(abilityGroupSource, "executeAiRequest", "emitAiExecutionInputDebug");
  return missingEmitterStart !== null
    && inputDebugStart !== null
    && missingEmitterStart < inputDebugStart
    && hasFunctionObjectProperty(abilityGroupSource, "dispatchAiDebugEmitterMissing", "failureReason")
    && hasStringArrayElements(abilityGroupSource, ["ai_debug_emitter_missing", "DebugEmitterMissing"]);
};

const hasLocalPreGatewayRequestDebug = (project: Project): boolean => {
  const localAdapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  const localDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`);
  const localDebugContractSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`);
  return hasFunctionCall(localAdapterSource, "executeLocalAiRuntimeRequest", "emitAiRequestDebug")
    && hasSourceCall(localDebugSource, "emitRequestDebug")
    && hasTypeAliasProperty(localDebugContractSource, "LocalAiDebugSession", "emitAiRequestDebug");
};

const hasRawResponseSuccessProof = (project: Project): boolean => {
  const successInvariantSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime-success-invariants.ts`);
  const localOutputSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-output.ts`);
  return hasFunctionObjectProperty(localOutputSource, "buildLocalAiSuccessOutput", "rawOutputRef")
    && hasFunctionObjectProperty(localOutputSource, "buildLocalAiSuccessOutput", "rawOutputHash")
    && hasStringArrayElements(successInvariantSource, [
      "success proof requires rawOutputRef",
      "success proof requires rawOutputHash",
      "success result requires runtimeProof.rawOutputHash",
    ]);
};

const collectRequestDebugStartFindings = (project: Project): Finding[] => {
  return hasAbilityPreParseRequestDebug(project) && hasDebugEmitterRequiredBeforeExecution(project) && hasExecutorPreRuntimeRequestDebug(project) && hasLocalPreGatewayRequestDebug(project)
    ? []
    : [createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-executor.ts`, line: 1, severity: "fatal", message: "AI runtime must emit AI_REQUEST_DEBUG before pre-runtime health gates and before provider/model await boundaries." })];
};

const collectAskAiProofFindings = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  if (!hasRawResponseSuccessProof(project)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/schema-runtime-success-invariants.ts`, line: 1, severity: "fatal", message: "ASK AI success must require rawResponseRef/rawResponseHash through runtime proof and result invariants." }));
  }
  return findings;
};

export const collectRuntimeFailureReasonFindings = (project: Project): Finding[] => {
  return [
    ...collectRuntimeStatusFindings(project),
    ...collectDispatchFailureEnvelopeFindings(project),
    ...collectOuterCatchDebugFindings(project),
    ...collectRequestDebugStartFindings(project),
    ...collectAskAiProofFindings(project),
  ];
};
