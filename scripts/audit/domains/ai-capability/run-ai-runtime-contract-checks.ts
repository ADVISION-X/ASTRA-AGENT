import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import { toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { hasLiteralTextFragment, hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";
import { findProofChainViolations } from "./run-ai-proof-chain-checks.js";
import { hasGovernedFailureStatusBranch } from "./runtime-result-shape.js";

const { AI_ROOT, DISABLED_EXECUTION_CHILD_IDS } = aiInspectionConstants;
const { getAiSources, getReferencesCount, getSourceOrThrow } = aiInspectionUtils;

const REQUIRED_EXECUTOR_CALLS = [
  { callName: "parseAiExecutorInput", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiProviderPolicy", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiDataPolicy", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiCostPolicy", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiPayloadBudgetGate", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiRuntimeHealthGate", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "runAiRuntimeCall", file: `${AI_ROOT}/runtime/ai-executor.ts` },
  { callName: "evaluateAiSafetyPolicy", file: `${AI_ROOT}/runtime/ai-runtime-result.ts` },
  { callName: "resolveAiSchemaContract", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "validateAiInternalCandidate", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "buildAiDisabledProviderOutput", file: `${AI_ROOT}/runtime/ai-pre-runtime.ts` },
  { callName: "evaluateAiOutputBoundary", file: `${AI_ROOT}/runtime/ai-runtime-result.ts` },
  { callName: "evaluateAiQualityGate", file: `${AI_ROOT}/runtime/ai-runtime-result.ts` },
  { callName: "buildAiResult", file: `${AI_ROOT}/runtime/ai-terminal-result.ts` },
] as const;

const findRequiredExecutorCalls = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const { callName, file } of REQUIRED_EXECUTOR_CALLS) {
    const source = getSourceOrThrow(project, file);
    if (hasCallExpression(source, callName)) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: toRepoRelativePath(source.getFilePath()), line: 1, severity: "fatal", message: `AI executor must route through ${callName}.` }));
  }
  return findings;
};

const findRuntimeContractViolations = (project: Project): Finding[] => {
  const runtimeResultSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-runtime-result.ts`);
  const executorSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-executor.ts`);
  const dispatchFailureSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-dispatch-failure.ts`);
  const findings: Finding[] = [];

  if (!hasGovernedFailureStatusBranch(runtimeResultSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-runtime-result.ts`, line: 1, severity: "fatal", message: "AI executor must keep schema/policy/quality rejection paths governed as review_required or failed, never clean success." }));
  }
  if (hasCallExpressionPath(executorSource, ["context", "runtime", "execute"])) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-executor.ts`, line: 1, severity: "fatal", message: "AI executor must call runtime only through ai-runtime-call-runner." }));
  }
  if (!hasDispatchFailureContract(dispatchFailureSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-dispatch-failure.ts`, line: 1, severity: "fatal", message: "AI dispatch failure must build a governed dispatch failure envelope." }));
  }

  return findings;
};

const hasDispatchFailureContract = (sourceFile: SourceFile): boolean => {
  const hasNamedImport = sourceFile.getImportDeclarations().some((declaration) => declaration.getNamedImports().some((named) => named.getName() === "AiDispatchFailureEnvelopeSchema"));
  return sourceFile.getExportedDeclarations().has("dispatchAiFailure") && hasNamedImport;
};

const findPublicContractViolations = (project: Project): Finding[] => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const indexSource = getSourceOrThrow(project, `${AI_ROOT}/index.ts`);
  const outputBoundarySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`);
  const runtimeSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime.schema.ts`);
  const findings: Finding[] = [];

  if (!hasThinAbilityGroup(abilityGroupSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must stay thin and route through parse, registry, router, and child execution only." }));
  }
  if (hasForbiddenThinEntryImports(abilityGroupSource) || hasNewDateAllocation(abilityGroupSource)) {
    findings.push(...createAbilityGroupBoundaryFindings(abilityGroupSource));
  }
  if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/index.ts`, line: 1, severity: "fatal", message: "AI index must not use export-star barrels." }));
  }
  findings.push(...findPublicContractLeaks(indexSource));
  findings.push(...findOutputBoundaryViolations(outputBoundarySource, runtimeSchemaSource));

  return findings;
};

const hasThinAbilityGroup = (sourceFile: SourceFile): boolean => {
  return hasCallExpression(sourceFile, "parseAiInput")
    && hasCallExpression(sourceFile, "createAiCapabilityRegistry")
    && hasCallExpression(sourceFile, "routeAiTaskToChild");
};

const hasForbiddenThinEntryImports = (sourceFile: SourceFile): boolean => {
  return ["local-ai-runtime-adapter", "model-roster", "ai-prompt-registry", "ai-clock"].some((specifier) => hasImportModuleSpecifier(sourceFile, specifier));
};

const hasNewDateAllocation = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
};

const createAbilityGroupBoundaryFindings = (sourceFile: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  if (hasForbiddenThinEntryImports(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must not assemble runtime, roster, prompt registry, or clock directly." }));
  }
  if (hasNewDateAllocation(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must not allocate time outside the clock port." }));
  }
  return findings;
};

const findPublicContractLeaks = (indexSource: SourceFile): Finding[] => {
  const publicAbilityGroup = indexSource.getExportedDeclarations().get("AiAbilityGroup")?.at(0);
  if (!publicAbilityGroup || !Node.isInterfaceDeclaration(publicAbilityGroup)) {
    return [];
  }

  const publicMethods = publicAbilityGroup.getMethods().map((method) => method.getName());
  return ["getPromptContract", "getModelRoster"].filter((forbiddenMethod) => publicMethods.includes(forbiddenMethod)).map(() => createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/contract.ts`, line: 1, severity: "fatal", message: "AI public ability-group contract must not leak prompt or model-roster internals." }));
};

const findOutputBoundaryViolations = (outputBoundarySource: SourceFile, runtimeSchemaSource: SourceFile): Finding[] => {
  const findings: Finding[] = [];
  if (!hasCallExpression(outputBoundarySource, "safeParse") || !hasImportModuleSpecifier(outputBoundarySource, "schema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must include a schema-level forbidden action output gate." }));
  }
  if (!hasCallExpression(outputBoundarySource, "collectForbiddenFields") || !outputBoundarySource.getVariableDeclaration("FORBIDDEN_OUTPUT_KEYS")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must recursively reject forbidden action output fields and aliases." }));
  }
  if (hasCallExpression(runtimeSchemaSource, "passthrough")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema-runtime.schema.ts`, line: 1, severity: "fatal", message: "AI forbidden action output schema must not use passthrough." }));
  }
  if (!hasLiteralTextFragment(runtimeSchemaSource, "failed and review_required result output must be null") || !hasLiteralTextFragment(runtimeSchemaSource, "success result requires confidence")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema-runtime.schema.ts`, line: 1, severity: "fatal", message: "AI result schema must reject failed/review output and success without confidence." }));
  }
  return findings;
};

const findFakeLiteralViolations = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const fakeLiteral of ["invalid-session", "invalid://input", "future-disabled"]) {
    for (const sourceFile of getAiSources(project)) {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (!hasStringLiteral(sourceFile, fakeLiteral)) {
        continue;
      }
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: `AI package must not contain fake failure proof literal ${fakeLiteral}.` }));
    }
  }
  return findings;
};

const findDisabledChildExecutionViolations = (project: Project): Finding[] => {
  const futureSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/children/future-api-ai/schema.ts`);
  const findings: Finding[] = [];
  if (futureSchemaSource.getVariableDeclaration("FutureApiAiSchemaPlaceholder")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/children/future-api-ai/schema.ts`, line: 1, severity: "fatal", message: "future-api-ai schema must not be a placeholder." }));
  }

  for (const childId of DISABLED_EXECUTION_CHILD_IDS) {
    const source = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/implementation.ts`);
    const hasExecuteMethod = source.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute");
    if (!hasExecuteMethod && !hasCallExpression(source, "executeAiChild")) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: `${AI_ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Disabled AI children must not expose execute or call executor." }));
  }

  return findings;
};

const findReferenceIntegrityViolations = (project: Project): Finding[] => {
  const proofBuilderSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-proof-builder.ts`);
  const resultBuilderSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-result-builder.ts`);
  const findings: Finding[] = [];

  if (!hasCallExpression(resultBuilderSource, "buildAiRuntimeProof")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-result-builder.ts`, line: 1, severity: "fatal", message: "AI result builder must construct runtimeProof through buildAiRuntimeProof." }));
  }
  if (getReferencesCount(proofBuilderSource, "buildAiRuntimeProof") < 2) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-proof-builder.ts`, line: 1, severity: "fatal", message: "AI proof builder must be referenced by the governed result path." }));
  }
  if (getReferencesCount(resultBuilderSource, "buildAiResult") < 2) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-result-builder.ts`, line: 1, severity: "fatal", message: "AI result builder must be referenced by executor and failure paths." }));
  }

  return findings;
};

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
      && signalArgument.getProperty("signal")?.getText().includes("controller.signal") === true;
  });
};

const hasAbortControllerTimeout = (sourceFile: SourceFile): boolean => {
  const hasAbortController = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "AbortController");
  return hasAbortController && hasCallExpressionPath(sourceFile, ["controller", "abort"]);
};

const hasPromiseRaceTimeout = (sourceFile: SourceFile): boolean => hasCallExpressionPath(sourceFile, ["Promise", "race"]);

const hasForbiddenModuleState = (sourceFile: SourceFile, variableName: string): boolean =>
  sourceFile.getVariableDeclaration(variableName)?.getFirstAncestorByKind(SyntaxKind.SourceFile) === sourceFile;

const findTimeoutCancellationViolations = (project: Project): Finding[] => {
  const runtimePortSource = getSourceOrThrow(project, `${AI_ROOT}/ports/ai-runtime-port.ts`);
  const runtimeCallRunnerSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`);
  const localGatewaySource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`);
  const localAdapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  const findings: Finding[] = [];

  if (!hasExecuteSignalOption(runtimePortSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/ports/ai-runtime-port.ts`, line: 1, severity: "fatal", message: "AI runtime port execute must accept a governed signal option." }));
  }
  if (!hasAbortControllerTimeout(runtimeCallRunnerSource) || !hasRuntimeSignalPropagation(runtimeCallRunnerSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`, line: 1, severity: "fatal", message: "AI runtime call runner must create AbortController timeout and pass controller.signal into runtime.execute." }));
  }
  if (hasPromiseRaceTimeout(localGatewaySource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`, line: 1, severity: "fatal", message: "Local AI timeout guard must not rely on Promise.race for timeout success handling." }));
  }
  if (hasForbiddenModuleState(localAdapterSource, "activeRuns") || hasForbiddenModuleState(localAdapterSource, "circuitBreaker")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI runtime adapter must not keep activeRuns or circuitBreaker as module-level mutable state." }));
  }

  return findings;
};

const hasPromptRegistryResolutionType = (sourceFile: SourceFile): boolean => {
  const resolveMethod = sourceFile.getInterface("AiPromptRegistryPort")?.getMethod("resolvePromptContract");
  return resolveMethod?.getReturnTypeNode()?.getText() === "AiPromptRegistryResolution"
    && sourceFile.getTypeAlias("AiPromptRegistryResolution") !== undefined;
};

const hasThrowStatement = (sourceFile: SourceFile): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;

const importsPromptCatalogBridge = (sourceFile: SourceFile, moduleSpecifier: string): boolean =>
  sourceFile.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);

const usesPromptBridgeCall = (sourceFile: SourceFile, functionName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getText() === functionName);

const findPromptGovernanceViolations = (project: Project): Finding[] => {
  const promptRegistryPortSource = getSourceOrThrow(project, `${AI_ROOT}/ports/ai-prompt-registry-port.ts`);
  const promptRegistrySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-prompt-registry.ts`);
  const localPromptRegistrySource = getSourceOrThrow(project, "src/lib/local-ai/prompt-registry.ts");
  const localRuntimeMapperSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-mapper.ts`);
  const findings: Finding[] = [];

  if (!hasPromptRegistryResolutionType(promptRegistryPortSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/ports/ai-prompt-registry-port.ts`, line: 1, severity: "fatal", message: "AI prompt registry port must expose a typed prompt resolution union." }));
  }
  if (hasThrowStatement(promptRegistrySource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/runtime/ai-prompt-registry.ts`, line: 1, severity: "fatal", message: "AI prompt registry must return governed typed failures instead of throwing." }));
  }
  if (
    localPromptRegistrySource.getVariableDeclaration("LOCAL_PROMPT_CONTRACTS")
    || !importsPromptCatalogBridge(localPromptRegistrySource, "../../capabilities/ai/prompt-contracts/registry.js")
  ) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: "src/lib/local-ai/prompt-registry.ts", line: 1, severity: "fatal", message: "Local AI prompt registry must derive prompt metadata from the AI prompt contract catalog and must not keep a second local prompt catalog." }));
  }
  if (!importsPromptCatalogBridge(localRuntimeMapperSource, "../prompt-contracts/registry.js") || !usesPromptBridgeCall(localRuntimeMapperSource, "getPromptContractCatalogEntryByLegacyTaskType")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006A-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-mapper.ts`, line: 1, severity: "fatal", message: "Local AI runtime mapper must read prompt metadata from the governed AI prompt contract catalog without a second local truth." }));
  }

  return findings;
};

export function runAiRuntimeContractChecks(project: Project): Finding[] {
  return [
    ...findRequiredExecutorCalls(project),
    ...findRuntimeContractViolations(project),
    ...findPublicContractViolations(project),
    ...findFakeLiteralViolations(project),
    ...findDisabledChildExecutionViolations(project),
    ...findReferenceIntegrityViolations(project),
    ...findTimeoutCancellationViolations(project),
    ...findPromptGovernanceViolations(project),
    ...findProofChainViolations(project),
  ];
}