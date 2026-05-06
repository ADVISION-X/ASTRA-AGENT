import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasStringLiteral } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";
import { findProofChainViolations } from "./run-ai-proof-chain-checks.js";
import { collectRuntimeFailureReasonFindings, hasGovernedFailureStatusBranch } from "./runtime-result-shape.js";
import { findOutputBoundaryViolations } from "./runtime-contract-output-boundary-checks.js";
import { findPromptGovernanceViolations } from "./runtime-contract-prompt-governance-checks.js";
import { findTimeoutCancellationViolations } from "./runtime-contract-timeout-checks.js";

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

const INPUT_SCHEMA_DIAGNOSTIC_REQUIRED_SNIPPETS = [
  "buildInputSchemaDiagnostics",
  "schemaIssueRef",
  "missingRequiredFields",
  "invalidFieldPaths",
  "actionableMessage",
] as const;

const INPUT_SCHEMA_DIAGNOSTIC_FORBIDDEN_SNIPPETS = [
  "base64",
  "rawPrompt",
  "cookie",
  "token",
] as const;

const findRequiredExecutorCalls = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const { callName, file } of REQUIRED_EXECUTOR_CALLS) {
    const source = getSourceOrThrow(project, file);
    if (hasCallExpression(source, callName)) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file, line: 1, severity: "fatal", message: `AI executor must route through ${callName}.` }));
  }
  return findings;
};

const hasDispatchFailureContract = (sourceFile: SourceFile): boolean => {
  const hasNamedImport = sourceFile.getImportDeclarations().some((declaration) => declaration.getNamedImports().some((named) => named.getName() === "AiDispatchFailureEnvelopeSchema"));
  return sourceFile.getExportedDeclarations().has("dispatchAiFailure") && hasNamedImport;
};

const includesAllSnippets = (text: string, snippets: readonly string[]): boolean => snippets.every((snippet) => text.includes(snippet));

const excludesAllSnippets = (text: string, snippets: readonly string[]): boolean => snippets.every((snippet) => !text.includes(snippet));

const hasInputSchemaDiagnostics = (sourceFile: SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return includesAllSnippets(text, INPUT_SCHEMA_DIAGNOSTIC_REQUIRED_SNIPPETS)
    && excludesAllSnippets(text, INPUT_SCHEMA_DIAGNOSTIC_FORBIDDEN_SNIPPETS);
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
  if (!hasInputSchemaDiagnostics(dispatchFailureSource)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-dispatch-failure.ts`, line: 1, severity: "fatal", message: "AI input_schema_invalid failures must emit safe schema diagnostics with schemaIssueRef, missingRequiredFields, and invalidFieldPaths, without raw prompts, images, cookies, or tokens." }));
  }

  return findings;
};

const hasObjectLiteralProperty = (sourceFile: SourceFile, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === propertyName)
  || sourceFile.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment).some((property) => property.getName() === propertyName)
  || sourceFile.getDescendantsOfKind(SyntaxKind.PropertySignature).some((property) => property.getName() === propertyName);

const hasCallWithObjectProperty = (sourceFile: SourceFile, callName: string, propertyName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== callName) {
      return false;
    }
    return callExpression.getArguments().some((argument) =>
      Node.isObjectLiteralExpression(argument)
      && argument.getProperties().some((property) => Node.isPropertyAssignment(property) && property.getName() === propertyName),
    );
  });

const collectRuntimeDebugShapeFindings = (project: Project): Finding[] => {
  const localAdapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  const localDebugSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`);
  const localDebugContractSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`);
  const findings: Finding[] = [];

  if (!hasCallExpression(localDebugSource, "emitErrorDebug") || !hasStringLiteral(localDebugSource, "AI_ERROR_DEBUG")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug.ts`, line: 1, severity: "fatal", message: "Local AI debug session must emit AI_ERROR_DEBUG through the structured debug port." }));
  }
  if (!hasCallExpression(localAdapterSource, "emitAiErrorDebug") || !hasObjectLiteralProperty(localDebugContractSource, "implementationStatus") || !hasObjectLiteralProperty(localDebugContractSource, "runtimeCallId") || !hasObjectLiteralProperty(localDebugContractSource, "diagnosticPayloadRef")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-debug-contract.ts`, line: 1, severity: "fatal", message: "AI runtime debug events must expose implementationStatus, runtimeCallId, and diagnosticPayloadRef without raw prompt/image payloads." }));
  }

  return findings;
};

const collectRuntimeDebugEmitterFindings = (project: Project): Finding[] => {
  const runtimeFactorySource = getSourceOrThrow(project, `${AI_ROOT}/runtime-factory.ts`);
  const executionContextSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-execution-context.ts`);
  const providerAwareSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/provider-aware-ai-runtime-adapter.ts`);
  const findings: Finding[] = [];

  if (!hasCallWithObjectProperty(runtimeFactorySource, "createProviderAwareAiRuntimePort", "emitDebugEvent")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime-factory.ts`, line: 1, severity: "fatal", message: "Configured AI runtime factory must inject emitDebugEvent into createProviderAwareAiRuntimePort." }));
  }
  if (!hasCallWithObjectProperty(executionContextSource, "createProviderAwareAiRuntimePort", "emitDebugEvent")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-execution-context.ts`, line: 1, severity: "fatal", message: "createAiExecutionContext must support governed emitDebugEvent injection instead of constructing an opaque runtime." }));
  }
  if (!hasCallWithObjectProperty(providerAwareSource, "createLocalAiRuntimePort", "emitDebugEvent")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime-adapters/provider-aware-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Provider-aware AI adapter must pass emitDebugEvent into the local AI runtime adapter." }));
  }

  return findings;
};

const findRuntimeDiagnosticTransparencyViolations = (project: Project): Finding[] => [
  ...collectRuntimeDebugEmitterFindings(project),
  ...collectRuntimeDebugShapeFindings(project),
  ...collectRuntimeFailureReasonFindings(project),
];

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
  return ["getPromptContract", "getModelRoster"]
    .filter((forbiddenMethod) => publicMethods.includes(forbiddenMethod))
    .map(() => createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/contract.ts`, line: 1, severity: "fatal", message: "AI public ability-group contract must not leak prompt or model-roster internals." }));
};

const findPublicContractViolations = (project: Project): Finding[] => {
  const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
  const indexSource = getSourceOrThrow(project, `${AI_ROOT}/index.ts`);
  const outputBoundarySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`);
  const runtimeSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime.schema.ts`);
  const runtimeBoundarySchemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime-output-boundary.schema.ts`);
  const runtimeSuccessInvariantSource = getSourceOrThrow(project, `${AI_ROOT}/schema-runtime-success-invariants.ts`);
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

  return [
    ...findings,
    ...findPublicContractLeaks(indexSource),
    ...findOutputBoundaryViolations({ outputBoundarySource, runtimeSchemaSource, runtimeBoundarySchemaSource, runtimeSuccessInvariantSource }),
  ];
};

const findFakeLiteralViolations = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const fakeLiteral of ["invalid-session", "invalid://input", "future-disabled"]) {
    for (const sourceFile of getAiSources(project)) {
      if (!hasStringLiteral(sourceFile, fakeLiteral)) {
        continue;
      }
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: sourceFile.getFilePath(), line: 1, severity: "fatal", message: `AI package must not contain fake failure proof literal ${fakeLiteral}.` }));
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
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005-V1", file: `${AI_ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Disabled AI children must not expose execute or call executor." }));
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

const findModelOwnedConfidenceViolations = (project: Project): Finding[] => {
  const promptSource = getSourceOrThrow(project, "src/lib/local-ai/local-ai-runtime-vision-prompt.ts");
  const parserSource = getSourceOrThrow(project, "src/lib/local-ai/local-ai-runtime-vision.ts");
  const taskSource = getSourceOrThrow(project, "src/lib/local-ai/local-ai-runtime-vision-task.ts");
  const findings: Finding[] = [];

  const confidenceAssignments = [
    ...promptSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
    ...parserSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
    ...taskSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
  ].filter((property) => property.getName() === "confidence");
  const hardcodedNumericConfidence = confidenceAssignments.find((property) => {
    const initializer = property.getInitializer();
    return initializer !== undefined && Node.isNumericLiteral(initializer);
  });

  if (hardcodedNumericConfidence) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-007A-V1",
      file: hardcodedNumericConfidence.getSourceFile().getFilePath(),
      line: hardcodedNumericConfidence.getStartLineNumber(),
      severity: "fatal",
      message: "Vision product-presence confidence must be model-owned; prompt templates and local vision parsing must not hard-code numeric confidence values that the model can copy or that runtime can substitute.",
    }));
  }
  if (!promptSource.getFullText().includes("AI_ESTIMATE_NUMBER_0_TO_1_DO_NOT_COPY_THIS_PLACEHOLDER") || !promptSource.getFullText().includes("confidence must be your own calibrated estimate")) {
    findings.push(createFinding({
      lawId: "GRASSEYE-AI-CAPABILITY-007A-V1",
      file: "src/lib/local-ai/local-ai-runtime-vision-prompt.ts",
      line: 1,
      severity: "fatal",
      message: "Vision product-presence prompt must explicitly require model-owned confidence and avoid a fixed numeric confidence example.",
    }));
  }

  return findings;
};

export function runAiRuntimeContractChecks(project: Project): Finding[] {
  return [
    ...findRequiredExecutorCalls(project),
    ...findRuntimeContractViolations(project),
    ...findRuntimeDiagnosticTransparencyViolations(project),
    ...findPublicContractViolations(project),
    ...findFakeLiteralViolations(project),
    ...findDisabledChildExecutionViolations(project),
    ...findReferenceIntegrityViolations(project),
    ...findModelOwnedConfidenceViolations(project),
    ...findTimeoutCancellationViolations(project),
    ...findPromptGovernanceViolations(project),
    ...findProofChainViolations(project),
  ];
}
