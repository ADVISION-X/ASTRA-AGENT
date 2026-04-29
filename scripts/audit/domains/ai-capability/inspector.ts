import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  getZodObjectPropertyNames,
  getZodEnumValues,
  hasCallExpression,
  hasCallExpressionPath,
  hasIdentifier,
  hasImportModuleSpecifier,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectMultiFrameAiBoundary } from "../multi-frame-evidence/inspector.js";
import { inspectLocalAiRuntimeBoundary } from "../local-ai-runtime/inspector.js";

const AI_ROOT = "src/capabilities/ai";
const CONTRACT_PATH = `${AI_ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${AI_ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${AI_ROOT}/registry.ts`;
const TASK_ROUTER_PATH = `${AI_ROOT}/task-router.ts`;
const MODEL_ROSTER_PATH = `${AI_ROOT}/model-roster.ts`;
const SCHEMA_VALIDATION_PATH = `${AI_ROOT}/schema-validation.ts`;
const INDEX_PATH = `${AI_ROOT}/index.ts`;
const RUNTIME_ROOT = `${AI_ROOT}/runtime`;
const POLICY_PATH = `${AI_ROOT}/shared/ai-policy.ts`;
const JSON_EXTRACT_PATH = `${AI_ROOT}/shared/ai-json-extract.ts`;
const RESULT_PATH = `${AI_ROOT}/shared/ai-result.ts`;
const FAILURE_PATH = `${AI_ROOT}/shared/ai-failure.ts`;
const RUNTIME_BRIDGE_PATH = `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`;
const RUNTIME_EXECUTOR_PATH = `${RUNTIME_ROOT}/ai-runtime-executor.ts`;
const RUNTIME_POLICY_GATE_PATH = `${RUNTIME_ROOT}/ai-runtime-policy-gate.ts`;
const RUNTIME_QUALITY_GATE_PATH = `${RUNTIME_ROOT}/ai-runtime-quality-gate.ts`;
const RUNTIME_SCHEMA_GATE_PATH = `${RUNTIME_ROOT}/ai-runtime-schema-gate.ts`;
const RUNTIME_FAILURE_RESULT_PATH = `${RUNTIME_ROOT}/ai-runtime-failure-result.ts`;
const RUNTIME_PROOF_BUILDER_PATH = `${RUNTIME_ROOT}/ai-runtime-proof-builder.ts`;
const RUNTIME_OUTPUT_NORMALIZER_PATH = `${RUNTIME_ROOT}/ai-runtime-output-normalizer.ts`;
const RUNTIME_RESULT_BUILDER_PATH = `${RUNTIME_ROOT}/ai-runtime-result-builder.ts`;
const FORBIDDEN_RUNTIME_TASK_PATH = `${AI_ROOT}/runtime-task-execution.ts`;
const FORBIDDEN_PROMPT_CONTRACT_PATH = `${AI_ROOT}/prompt-contract.ts`;
const LOCAL_AI_TYPES_PATH = "src/types/local-ai.ts";
const LOCAL_AI_MODEL_CONFIG_PATH = "src/lib/local-ai/model-config.ts";

const AI_PRIVATE_PATH_PREFIXES = [`${AI_ROOT}/children/`, `${AI_ROOT}/shared/`, `${AI_ROOT}/runtime-adapters/`] as const;

const PERSISTENCE_DOWNSTREAM_PATH_PREFIXES = [
  "src/capabilities/forensics-persistence/",
  "src/lib/storage/evidence-store/",
] as const;

const PERSISTENCE_DOWNSTREAM_FILE_PATHS: string[] = [];

const PAID_CHILDREN = [
  {
    childCapabilityId: "paid-vision-ai",
    filePath: `${AI_ROOT}/children/paid-vision-ai/implementation.ts`,
    factoryName: "createPaidVisionAiCapability",
  },
  {
    childCapabilityId: "paid-analysis-ai",
    filePath: `${AI_ROOT}/children/paid-analysis-ai/implementation.ts`,
    factoryName: "createPaidAnalysisAiCapability",
  },
  {
    childCapabilityId: "future-api-ai",
    filePath: `${AI_ROOT}/children/future-api-ai/implementation.ts`,
    factoryName: "createFutureApiAiCapability",
  },
] as const;

const FORBIDDEN_PUBLIC_EXPORT_NAMES = [
  "createAiCapabilityRegistry",
  "extractFirstJsonBlock",
  "parseExtractedJson",
  "AI_ALLOWED_CALLERS",
  "AI_FORBIDDEN_RESPONSIBILITIES",
  "assertAiReadOnlyBoundary",
  "hasExplicitPaidExecutionPolicy",
  "isPaidAiPolicyEnabled",
  "summarizeAiResult",
  "AiRuntimeProof",
  "AiRuntimeProofStatus",
] as const;

const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  TASK_ROUTER_PATH,
  MODEL_ROSTER_PATH,
  SCHEMA_VALIDATION_PATH,
  INDEX_PATH,
  POLICY_PATH,
  JSON_EXTRACT_PATH,
  RESULT_PATH,
  FAILURE_PATH,
  RUNTIME_BRIDGE_PATH,
  RUNTIME_EXECUTOR_PATH,
  RUNTIME_POLICY_GATE_PATH,
  RUNTIME_QUALITY_GATE_PATH,
  RUNTIME_SCHEMA_GATE_PATH,
  RUNTIME_FAILURE_RESULT_PATH,
  RUNTIME_PROOF_BUILDER_PATH,
  RUNTIME_OUTPUT_NORMALIZER_PATH,
  RUNTIME_RESULT_BUILDER_PATH,
  `${AI_ROOT}/children/local-vision-ai/implementation.ts`,
  `${AI_ROOT}/children/local-text-ai/implementation.ts`,
  `${AI_ROOT}/children/local-ocr-ai/implementation.ts`,
  `${AI_ROOT}/children/internal-schema-validator/implementation.ts`,
  `${AI_ROOT}/children/paid-vision-ai/implementation.ts`,
  `${AI_ROOT}/children/paid-analysis-ai/implementation.ts`,
  `${AI_ROOT}/children/future-api-ai/implementation.ts`,
] as const;

const REQUIRED_TASK_TYPES = [
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "schema_validation_only",
] as const;

const LEGACY_TASK_TYPES = [
  "vision.productPresence",
  "comments.ocr_cleanup",
  "comments.intent_analysis",
  "product.signal_summary",
] as const;

const FORBIDDEN_IMPORT_SEGMENTS = [
  "capabilities/forensics-persistence",
  "features/local-data",
  "types/evidence-packet",
  "features/platform-action",
  "browser/browser-controller",
  "capabilities/open/children",
  "capabilities/mouse-click/children",
  "capabilities/mouse-scroll/children",
] as const;

function hasRegexLiteral(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).length > 0;
}

function hasMatchCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "match";
  });
}

function hasVerifyFunction(sourceFile: SourceFile): boolean {
  const functionNames = sourceFile.getFunctions().map((fn) => fn.getName() ?? "");
  const variableNames = sourceFile.getVariableDeclarations().map((declaration) => declaration.getName());
  return [...functionNames, ...variableNames].some((name) => name.startsWith("verify"));
}

function hasDynamicImportCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    return callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword;
  });
}

function hasUnsafeTypeEscape(sourceFile: SourceFile): boolean {
  if (sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword).length > 0) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const typeNode = expression.getTypeNode();
    if (!typeNode) {
      return false;
    }
    const innerExpression = expression.getExpression();
    const innerTypeNode = Node.isAsExpression(innerExpression) ? innerExpression.getTypeNode() : undefined;
    return typeNode.getText() === 'LocalAiTaskRequest["input"]'
      || typeNode.getText() === "LocalAiTaskRequest['input']"
      || innerTypeNode?.getText() === "unknown";
  });
}

function toRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

function isPathWithin(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
}

function resolveModuleSourcePath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const sourceFile = declaration.getModuleSpecifierSourceFile();
  return sourceFile ? toRepoPath(sourceFile) : null;
}

function getLiteralTexts(node: Node): string[] {
  return node.getDescendants().flatMap((descendant) => {
    if (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)) {
      return [descendant.getLiteralText()];
    }

    return [];
  });
}

function hasExactLiteralValue(node: Node, literalValue: string): boolean {
  return getLiteralTexts(node).some((value) => value === literalValue);
}

function getReturnedObjectLiteral(node: Node): ObjectLiteralExpression | null {
  for (const statement of node.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    const expression = statement.getExpression();
    if (expression && Node.isObjectLiteralExpression(expression)) {
      return expression;
    }
  }

  return null;
}

function getReturnedFactoryObjectLiteral(sourceFile: SourceFile, factoryName: string): ObjectLiteralExpression | null {
  const factory = sourceFile.getFunction(factoryName);
  if (!factory) {
    return null;
  }

  return getReturnedObjectLiteral(factory);
}

function getObjectMethod(objectLiteral: ObjectLiteralExpression, methodName: string): Node | null {
  const method = objectLiteral.getProperties().find((property) => Node.isMethodDeclaration(property) && property.getName() === methodName);
  return method ?? null;
}

function methodReturnsBooleanLiteral(method: Node | null, expected: boolean): boolean {
  if (!method) {
    return false;
  }

  return method.getDescendantsOfKind(SyntaxKind.ReturnStatement).some((statement) => {
    const expression = statement.getExpression();
    return expected ? expression?.getKind() === SyntaxKind.TrueKeyword : expression?.getKind() === SyntaxKind.FalseKeyword;
  });
}

function methodThrows(method: Node | null): boolean {
  return method ? method.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0 : false;
}

function objectPropertyMatchesLiteral(
  objectLiteral: ObjectLiteralExpression | null,
  propertyName: string,
  expectedValue: string | boolean,
): boolean {
  if (!objectLiteral) {
    return false;
  }

  const property = objectLiteral.getProperties().find((candidate) => {
    return Node.isPropertyAssignment(candidate) && candidate.getName() === propertyName;
  });
  if (!property || !Node.isPropertyAssignment(property)) {
    return false;
  }

  const initializer = property.getInitializer();
  if (!initializer) {
    return false;
  }

  if (typeof expectedValue === "string") {
    return (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))
      && initializer.getLiteralText() === expectedValue;
  }

  return expectedValue ? initializer.getKind() === SyntaxKind.TrueKeyword : initializer.getKind() === SyntaxKind.FalseKeyword;
}

function getRegistryChildCounts(sourceFile: SourceFile): Map<string, number> {
  const counts = new Map<string, number>();
  const factory = sourceFile.getFunction("createAiCapabilityRegistry");
  if (!factory) {
    return counts;
  }

  const mapExpression = factory.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => {
    return Node.isIdentifier(expression.getExpression()) && expression.getExpression().getText() === "Map";
  });
  const entriesArgument = mapExpression?.getArguments()[0];
  if (!entriesArgument || !Node.isArrayLiteralExpression(entriesArgument)) {
    return counts;
  }

  for (const entry of entriesArgument.getElements()) {
    if (!Node.isArrayLiteralExpression(entry)) {
      continue;
    }

    const keyNode = entry.getElements()[0];
    if (!keyNode || (!Node.isStringLiteral(keyNode) && !Node.isNoSubstitutionTemplateLiteral(keyNode))) {
      continue;
    }

    const key = keyNode.getLiteralText();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function getZodObjectPropertyInitializerText(sourceFile: SourceFile, declarationName: string, propertyName: string): string | null {
  const declaration = sourceFile.getVariableDeclaration(declarationName);
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.CallExpression);
  const firstArgument = initializer?.getArguments()[0];
  if (!firstArgument || !Node.isObjectLiteralExpression(firstArgument)) {
    return null;
  }

  const property = firstArgument.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) {
    return null;
  }

  return property.getInitializer()?.getText() ?? null;
}

function hasSchemaInvalidFailureAssignment(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).some((ifStatement) => {
    if (!hasIdentifier(ifStatement.getExpression(), "schemaIssues")) {
      return false;
    }

    return ifStatement.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((expression) => {
      return expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken
        && expression.getLeft().getText() === "status"
        && expression.getRight().getText() === 'input.request.safetyPolicy.reviewOnSchemaFailure ? "review_required" : "failed"';
    });
  });
}

function getDisabledRosterEntryIds(sourceFile: SourceFile): Set<string> {
  return new Set(
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((expression) => {
      const callee = expression.getExpression();
      if (!Node.isIdentifier(callee) || callee.getText() !== "buildDisabledEntry") {
        return [];
      }

      const childCapabilityId = expression.getArguments()[0];
      const status = expression.getArguments()[2];
      if (
        (Node.isStringLiteral(childCapabilityId) || Node.isNoSubstitutionTemplateLiteral(childCapabilityId))
        && (Node.isStringLiteral(status) || Node.isNoSubstitutionTemplateLiteral(status))
        && status.getLiteralText() === "disabled_by_policy"
      ) {
        return [childCapabilityId.getLiteralText()];
      }

      return [];
    }),
  );
}

function collectAiSourceFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => isPathWithin(toRepoPath(sourceFile), [`${AI_ROOT}/`]));
}

export default createPendingDomainInspector({
  inspector: "GrassEye AI Capability Owner Inspector",
  inspectorId: "ai-capability-owner",
  capabilityDomain: "ai-capability",
  inspectorEntry: "scripts/audit/domains/ai-capability/inspector.ts",
  ownedPaths: [AI_ROOT],
  pendingSummary: "ai-capability law exists but the hardened AI public owner boundary is not fully enforced yet",
  implementedSummary: "ai-capability is enforced as the canonical AI public owner with a native contract, internal runtime bridge, and anti-escape checks",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_VALIDATION_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const policySource = getSourceFileOrThrow(project, POLICY_PATH);
    const jsonExtractSource = getSourceFileOrThrow(project, JSON_EXTRACT_PATH);
    const modelRosterSource = getSourceFileOrThrow(project, MODEL_ROSTER_PATH);
    const runtimeBridgeSource = getSourceFileOrThrow(project, RUNTIME_BRIDGE_PATH);
    const taskRouterSource = getSourceFileOrThrow(project, TASK_ROUTER_PATH);
    const runtimeExecutorSource = getSourceFileOrThrow(project, RUNTIME_EXECUTOR_PATH);
    const runtimePolicyGateSource = getSourceFileOrThrow(project, RUNTIME_POLICY_GATE_PATH);
    const runtimeQualityGateSource = getSourceFileOrThrow(project, RUNTIME_QUALITY_GATE_PATH);
    const runtimeSchemaGateSource = getSourceFileOrThrow(project, RUNTIME_SCHEMA_GATE_PATH);
    const runtimeFailureResultSource = getSourceFileOrThrow(project, RUNTIME_FAILURE_RESULT_PATH);
    const runtimeProofBuilderSource = getSourceFileOrThrow(project, RUNTIME_PROOF_BUILDER_PATH);
    const runtimeResultBuilderSource = getSourceFileOrThrow(project, RUNTIME_RESULT_BUILDER_PATH);
    const localVisionSource = getSourceFileOrThrow(project, `${AI_ROOT}/children/local-vision-ai/implementation.ts`);
    const localTextSource = getSourceFileOrThrow(project, `${AI_ROOT}/children/local-text-ai/implementation.ts`);
    const localOcrSource = getSourceFileOrThrow(project, `${AI_ROOT}/children/local-ocr-ai/implementation.ts`);
    const internalSchemaSource = getSourceFileOrThrow(project, `${AI_ROOT}/children/internal-schema-validator/implementation.ts`);
    const paidAnalysisSource = getSourceFileOrThrow(project, `${AI_ROOT}/children/paid-analysis-ai/implementation.ts`);
    const aiFiles = collectAiSourceFiles(project);
    const downstreamPersistenceFiles = project.getSourceFiles().filter((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return isPathWithin(relativePath, PERSISTENCE_DOWNSTREAM_PATH_PREFIXES)
        || PERSISTENCE_DOWNSTREAM_FILE_PATHS.includes(relativePath as (typeof PERSISTENCE_DOWNSTREAM_FILE_PATHS)[number]);
    });
    const findings: Finding[] = [];

    const requiredPresence = await Promise.all(
      REQUIRED_FILES.map(async (filePath) => ({ filePath, exists: await fileExists(pathFromRepoRoot(filePath)) })),
    );
    for (const entry of requiredPresence) {
      if (!entry.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: entry.filePath, line: 1, severity: "fatal", message: "AI hardened required shape file is missing." }));
      }
    }

    const inputFields = getTypeAliasPropertyNames(contractSource, "AiAbilityInput");
    const resultFields = getTypeAliasPropertyNames(contractSource, "AiAbilityResult");
    const taskTypes = new Set(getZodEnumValues(schemaSource, "AiTaskTypeSchema"));
    const contractPassed = [
      "abilityGroupId",
      "taskType",
      "inputModality",
      "inputRefs",
      "promptContractId",
      "expectedOutputSchema",
      "requestedBy",
      "transportedBy",
      "sessionId",
      "roundId",
      "videoVisitId",
      "qualityPolicy",
      "providerPolicy",
      "costPolicy",
      "dataPolicy",
      "safetyPolicy",
      "input",
    ].every((field) => inputFields.has(field))
      && [
        "status",
        "abilityGroupId",
        "childCapabilityId",
        "taskType",
        "modelProvider",
        "modelName",
        "runtime",
        "implementationStatus",
        "output",
        "rawOutputRef",
        "schemaValidationStatus",
        "confidence",
        "failureReason",
        "durationMs",
        "costEstimate",
        "evidenceRefs",
        "debugLogRef",
        "runtimeProof",
      ].every((field) => resultFields.has(field))
      && REQUIRED_TASK_TYPES.every((taskType) => taskTypes.has(taskType))
      && hasInterfaceMethod(contractSource, "AiAbilityGroup", "execute")
      && hasInterfaceMethod(contractSource, "AiChildCapability", "execute")
      && hasInterfaceMethod(contractSource, "AiRuntimeBridge", "execute");
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "error", message: "AI contract must expose native AI input/result types, required task types, and execute interfaces without leaking LocalAi public types." }));
    }

    const runtimeProofSchemaFields = getZodObjectPropertyNames(schemaSource, "AiRuntimeProofSchema");
    const schemaClosurePassed = hasIdentifier(schemaSource, "AI_CHILD_CAPABILITY_IDS")
      && hasIdentifier(schemaSource, "AiChildCapabilityIdSchema")
      && getZodObjectPropertyInitializerText(schemaSource, "AiProviderPolicySchema", "providerAllowlist") === "z.array(AiChildCapabilityIdSchema)"
      && getZodObjectPropertyInitializerText(schemaSource, "AiRuntimeProofSchema", "childCapabilityId") === "AiChildCapabilityIdSchema"
      && getZodObjectPropertyInitializerText(schemaSource, "baseResultSchema", "childCapabilityId") === "AiChildCapabilityIdSchema"
      && [
        "runId",
        "missionId",
        "capabilityId",
        "childCapabilityId",
        "inputSummary",
        "outputSummary",
        "errorCode",
        "evidenceRef",
        "timestamp",
      ].every((field) => runtimeProofSchemaFields.has(field));
    if (!schemaClosurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: SCHEMA_VALIDATION_PATH, line: 1, severity: "fatal", message: "AI schema-validation must stay closed over contract child ids and runtimeProof fields, including internal-schema-validator." }));
    }

    const registryChildCounts = getRegistryChildCounts(registrySource);
    const childStructurePassed = [
      "local-vision-ai",
      "local-text-ai",
      "local-ocr-ai",
      "internal-schema-validator",
      "paid-vision-ai",
      "paid-analysis-ai",
      "future-api-ai",
    ].every((child) => registryChildCounts.get(child) === 1);
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: REGISTRY_PATH, line: 1, severity: "error", message: "AI registry must contain every declared child capability exactly once." }));
    }

    const abilityGroupPassed = hasIdentifier(abilityGroupSource, "createDefaultAiRuntimeBridge")
      && hasIdentifier(abilityGroupSource, "createAiCapabilityRegistry")
      && hasIdentifier(abilityGroupSource, "routeAiTaskToChild")
      && hasCallExpression(abilityGroupSource, "validateAiAbilityInput");
    if (!abilityGroupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "error", message: "AI ability-group entry must use the registry, task router, and owned runtime bridge." }));
    }

    const runtimePolicyGatePassed = hasImportModuleSpecifier(runtimeBridgeSource, "ai-runtime-executor")
      && hasCallExpression(runtimeExecutorSource, "collectAiRuntimePolicyViolations")
      && hasCallExpression(runtimeExecutorSource, "buildAiPolicyFailureResult")
      && hasCallExpression(runtimePolicyGateSource, "resolveAiPolicyViolationReasons");
    if (!runtimePolicyGatePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "fatal", message: "AI runtime bridge must execute explicit policy gate and governed policy failure handling before provider execution." }));
    }

    const runtimeSchemaGatePassed = hasImportModuleSpecifier(runtimeExecutorSource, "ai-runtime-schema-gate")
      && hasCallExpression(runtimeExecutorSource, "inspectAiOutputSchema")
      && hasCallExpression(runtimeSchemaGateSource, "resolveAiExpectedOutputTask")
      && hasCallExpression(runtimeSchemaGateSource, "safeParseAiTaskOutput")
      && hasIdentifier(registrySource, "createInternalSchemaValidatorCapability")
      && hasExactLiteralValue(registrySource, "internal-schema-validator")
      && hasExactLiteralValue(taskRouterSource, "internal-schema-validator");
    if (!runtimeSchemaGatePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "fatal", message: "AI runtime bridge must execute governed schema validation for schema_validation_only and post-result schema gates." }));
    }

    const runtimeFailureHandlingPassed = hasImportModuleSpecifier(runtimeExecutorSource, "ai-runtime-failure-result")
      && hasCallExpression(runtimeExecutorSource, "buildAiRuntimeFailureResult")
      && hasCallExpression(runtimeFailureResultSource, "describeLocalAiFailure");
    if (!runtimeFailureHandlingPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "fatal", message: "Local AI runtime failures must be converted into governed AI results inside the owned runtime bridge." }));
    }

    const runtimeQualityGatePassed = hasImportModuleSpecifier(runtimeExecutorSource, "ai-runtime-quality-gate")
      && hasCallExpression(runtimeExecutorSource, "evaluateAiQualityGate")
      && hasIdentifier(runtimeQualityGateSource, "minimumConfidence")
      && hasIdentifier(runtimeQualityGateSource, "reviewOnLowConfidence")
      && hasIdentifier(runtimeQualityGateSource, "reviewOnSchemaFailure")
      && hasIdentifier(runtimeQualityGateSource, "reviewOnPolicyViolation");
    if (!runtimeQualityGatePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "fatal", message: "AI runtime bridge must execute quality and safety policy gates on confidence, schema failure, and policy violation." }));
    }

    const invalidSchemaSuccessGuardPassed = !hasIdentifier(runtimeQualityGateSource, "requireSchemaValidation")
      && hasSchemaInvalidFailureAssignment(runtimeQualityGateSource);
    if (!invalidSchemaSuccessGuardPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: RUNTIME_QUALITY_GATE_PATH, line: 1, severity: "fatal", message: "AI quality gate must never allow schemaValidationStatus=invalid to return success." }));
    }

    const runtimeProofCoveragePassed = hasImportModuleSpecifier(runtimeFailureResultSource, "ai-runtime-result-builder")
      && hasCallExpression(runtimeResultBuilderSource, "buildAiRuntimeProof")
      && hasIdentifier(runtimeProofBuilderSource, "reviewRequiredReason")
      && hasIdentifier(runtimeProofBuilderSource, "dataQualityFlags")
      && hasIdentifier(runtimeProofBuilderSource, "durationMs");
    if (!runtimeProofCoveragePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "fatal", message: "AI runtime bridge must build complete runtime proof for success, failed, and review_required paths." }));
    }

    const dispatchFailurePassed = hasCallExpression(abilityGroupSource, "buildAiDispatchFailureResult")
      && runtimeFailureResultSource.getFunction("buildAiDispatchFailureResult") !== undefined
      && !hasExactLiteralValue(abilityGroupSource, "AI child capability is not registered for ")
      && [localVisionSource, localTextSource, localOcrSource, internalSchemaSource, paidAnalysisSource].every((sourceFile) => {
        const returnedObject = getReturnedFactoryObjectLiteral(sourceFile, sourceFile === localVisionSource
          ? "createLocalVisionAiCapability"
          : sourceFile === localTextSource
            ? "createLocalTextAiCapability"
            : sourceFile === localOcrSource
              ? "createLocalOcrAiCapability"
              : sourceFile === internalSchemaSource
                ? "createInternalSchemaValidatorCapability"
                : "createPaidAnalysisAiCapability");
        const executeMethod = returnedObject ? getObjectMethod(returnedObject, "execute") : null;
        return Boolean(executeMethod) && !methodThrows(executeMethod);
      });
    if (!dispatchFailurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "AI ability-group dispatch must convert missing child, task mismatch, and child execute exceptions into governed failed results without naked throws." }));
    }

    const disabledRosterEntryIds = getDisabledRosterEntryIds(modelRosterSource);
    const paidPolicyFunction = policySource.getFunction("hasExplicitPaidExecutionPolicy");
    const paidPolicyPassed = Boolean(paidPolicyFunction)
      && [
        "allowPaidProvider",
        "providerAllowlist",
        "allowExternalTransmission",
        "maxEstimatedCost",
        "operatorApprovalRef",
      ].every((identifierName) => hasIdentifier(paidPolicyFunction!, identifierName));

    const disabledChildFilesPassed = PAID_CHILDREN.every((child) => {
      const sourceFile = getSourceFileOrThrow(project, child.filePath);
      const returnedObject = getReturnedFactoryObjectLiteral(sourceFile, child.factoryName);
      const canHandleMethod = returnedObject ? getObjectMethod(returnedObject, "canHandle") : null;
      const checkReadinessMethod = returnedObject ? getObjectMethod(returnedObject, "checkReadiness") : null;
      const executeMethod = returnedObject ? getObjectMethod(returnedObject, "execute") : null;
      const readinessObject = checkReadinessMethod ? getReturnedObjectLiteral(checkReadinessMethod) : null;

      if (["paid-vision-ai", "paid-analysis-ai", "future-api-ai"].includes(child.childCapabilityId)) {
        return !hasCallExpressionPath(executeMethod ?? sourceFile, ["context", "runtime", "execute"])
          && hasCallExpression(executeMethod ?? sourceFile, "buildAiPolicyFailureResult")
          && objectPropertyMatchesLiteral(readinessObject, "status", "disabled_by_policy")
          && objectPropertyMatchesLiteral(readinessObject, "enabledByPolicy", false)
          && disabledRosterEntryIds.has(child.childCapabilityId);
      }

      return methodReturnsBooleanLiteral(canHandleMethod, false)
        && objectPropertyMatchesLiteral(readinessObject, "status", "disabled_by_policy")
        && objectPropertyMatchesLiteral(readinessObject, "enabledByPolicy", false)
        && methodThrows(executeMethod)
        && disabledRosterEntryIds.has(child.childCapabilityId);
    });

    if (!paidPolicyPassed || !disabledChildFilesPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005-V1", file: POLICY_PATH, line: 1, severity: "error", message: "Paid and future AI children must stay explicitly visible, disabled_by_policy by default, and guarded by explicit paid-provider policy requirements." }));
    }

    const capabilityCheckViolations = (await listFilesRecursive(pathFromRepoRoot(AI_ROOT), { extensions: [".ts"] }))
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((filePath) => filePath.endsWith("/capability-check.ts"));
    const runtimeTaskExists = await fileExists(pathFromRepoRoot(FORBIDDEN_RUNTIME_TASK_PATH));
    const promptContractExists = await fileExists(pathFromRepoRoot(FORBIDDEN_PROMPT_CONTRACT_PATH));
    if (runtimeTaskExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: FORBIDDEN_RUNTIME_TASK_PATH, line: 1, severity: "fatal", message: "runtime-task-execution.ts must not remain inside the AI root." }));
    }
    if (promptContractExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: FORBIDDEN_PROMPT_CONTRACT_PATH, line: 1, severity: "fatal", message: "prompt-contract.ts must not survive as an AI public shortcut." }));
    }
    if (capabilityCheckViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007-V1", file: capabilityCheckViolations[0]!, line: 1, severity: "fatal", message: "capability-check.ts must not survive under the AI root." }));
    }

    const forbiddenImportViolations = aiFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        return resolvedTargetPath && isPathWithin(resolvedTargetPath, FORBIDDEN_IMPORT_SEGMENTS) ? [relativePath] : [];
      });
    });
    if (forbiddenImportViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: forbiddenImportViolations[0]!, line: 1, severity: "fatal", message: "AI root must not import Forensics, local-data, evidence-packet, platform-action, BrowserController, or action child owners." }));
    }

    const legacyLeakViolations = aiFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      if (relativePath === RUNTIME_BRIDGE_PATH) {
        return [];
      }

      const importsLegacy = sourceFile.getImportDeclarations().some((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        return resolvedTargetPath === LOCAL_AI_TYPES_PATH
          || (resolvedTargetPath !== null && isPathWithin(resolvedTargetPath, ["src/lib/local-ai/"]) && resolvedTargetPath !== LOCAL_AI_MODEL_CONFIG_PATH);
      });
      const hasLegacyIdentifiers = hasIdentifier(sourceFile, "LocalAiTaskRequest") || hasIdentifier(sourceFile, "LocalAiTaskResult") || hasIdentifier(sourceFile, "LocalAiTaskType");
      const hasLegacyLiterals = getLiteralTexts(sourceFile).some((literal) => LEGACY_TASK_TYPES.includes(literal as (typeof LEGACY_TASK_TYPES)[number]));

      return importsLegacy || hasLegacyIdentifiers || hasLegacyLiterals ? [relativePath] : [];
    });
    if (legacyLeakViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: legacyLeakViolations[0]!, line: 1, severity: "fatal", message: "Legacy LocalAi contracts and task names must remain bridge-only and must not leak into the wider AI root." }));
    }

    const externalChildImportViolations = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        if (!resolvedTargetPath || isPathWithin(relativePath, [`${AI_ROOT}/`])) {
          return [];
        }

        return isPathWithin(resolvedTargetPath, [`${AI_ROOT}/children/`]) ? [relativePath] : [];
      });
    });
    const externalPrivateImportViolations = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        if (!resolvedTargetPath || isPathWithin(relativePath, [`${AI_ROOT}/`])) {
          return [];
        }

        return isPathWithin(resolvedTargetPath, AI_PRIVATE_PATH_PREFIXES) || resolvedTargetPath === FORBIDDEN_PROMPT_CONTRACT_PATH
          ? [relativePath]
          : [];
      });
    });
    if (externalChildImportViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: externalChildImportViolations[0]!, line: 1, severity: "fatal", message: "AI child implementations must not be imported outside the AI canonical root." }));
    }
    if (externalPrivateImportViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: externalPrivateImportViolations[0]!, line: 1, severity: "fatal", message: "AI private shared files and runtime adapters must not be imported outside the AI canonical root." }));
    }

    const indexLeaks = indexSource.getExportDeclarations().some((declaration) => {
      const resolvedTargetPath = resolveModuleSourcePath(declaration);
      if (!resolvedTargetPath) {
        return false;
      }

      return isPathWithin(resolvedTargetPath, [`${AI_ROOT}/children/`])
        || resolvedTargetPath === FORBIDDEN_RUNTIME_TASK_PATH
        || resolvedTargetPath === FORBIDDEN_PROMPT_CONTRACT_PATH;
    })
      || indexSource.getExportDeclarations().some((declaration) => {
        return declaration.getNamedExports().some((exportSpecifier) => {
          return FORBIDDEN_PUBLIC_EXPORT_NAMES.includes(exportSpecifier.getName() as (typeof FORBIDDEN_PUBLIC_EXPORT_NAMES)[number]);
        });
      })
      || hasIdentifier(indexSource, "LocalAiTaskRequest")
      || hasIdentifier(indexSource, "LocalAiTaskResult")
      || hasIdentifier(indexSource, "LocalAiTaskType")
      || hasIdentifier(indexSource, "toLegacyLocalAiTaskResult");
    if (indexLeaks) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "AI public index must not export children, runtime-task execution helpers, prompt-contract facades, capability checks, or legacy LocalAi public types." }));
    }

    const sideEffectViolations = aiFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return hasCallExpression(sourceFile, "writeAiResultRecord")
        || hasCallExpression(sourceFile, "emitSupplementalRuntimeEvent")
        || hasIdentifier(sourceFile, "RuntimeDeliveryState")
        ? [relativePath]
        : [];
    });
    if (sideEffectViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: sideEffectViolations[0]!, line: 1, severity: "fatal", message: "AI group must not write forensics, emit runtime-proof events directly, or mutate RuntimeDeliveryState." }));
    }

    const agentRuntimeLeak = aiFiles.some((sourceFile) => hasExactLiteralValue(sourceFile, "agent-runtime"));
    if (agentRuntimeLeak) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: POLICY_PATH, line: 1, severity: "fatal", message: "agent-runtime must not survive in AI caller policy, requestedBy, or any AI-root source." }));
    }

    const directTransportLeak = [contractSource, schemaSource, policySource].some((sourceFile) => {
      return hasExactLiteralValue(sourceFile, "direct");
    });
    if (directTransportLeak) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "fatal", message: "AI transport must be governed through nerve-bus and must not keep a direct-transport contract path." }));
    }

    const verifyViolations = aiFiles
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasVerifyFunction(sourceFile) }))
      .filter((entry) => entry.violates);
    if (verifyViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007-V1", file: verifyViolations[0]!.file, line: 1, severity: "fatal", message: "verify* functions must not exist inside the AI root." }));
    }

    const jsonExtractionPassed = !hasRegexLiteral(jsonExtractSource) && !hasMatchCall(jsonExtractSource);
    if (!jsonExtractionPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007-V1", file: JSON_EXTRACT_PATH, line: 1, severity: "error", message: "AI JSON extraction must use manual scanning and must not rely on RegExp literals or raw.match." }));
    }

    const persistenceImportLeakViolations = downstreamPersistenceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      const importsAiPublicOrPrivateContract = sourceFile.getImportDeclarations().some((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        return resolvedTargetPath === INDEX_PATH
          || resolvedTargetPath === FORBIDDEN_PROMPT_CONTRACT_PATH
          || (resolvedTargetPath !== null && isPathWithin(resolvedTargetPath, AI_PRIVATE_PATH_PREFIXES));
      });
      const importsLegacyLocalAiResult = sourceFile.getImportDeclarations().some((declaration) => {
        const resolvedTargetPath = resolveModuleSourcePath(declaration);
        return resolvedTargetPath === LOCAL_AI_TYPES_PATH
          && declaration.getNamedImports().some((namedImport) => {
            return ["LocalAiTaskRequest", "LocalAiTaskResult", "LocalAiTaskType", "LocalAiTaskResultSchema"].includes(namedImport.getName());
          });
      });

      return importsAiPublicOrPrivateContract || importsLegacyLocalAiResult ? [relativePath] : [];
    });
    if (persistenceImportLeakViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: persistenceImportLeakViolations[0]!, line: 1, severity: "fatal", message: "Persistence and Forensics downstream surfaces must not treat AI runtime contracts, prompt shortcuts, or LocalAiTaskResult as public persistence truth." }));
    }

    const persistenceLegacyOwnershipLeaks = downstreamPersistenceFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return getLiteralTexts(sourceFile).some((literal) => LEGACY_TASK_TYPES.includes(literal as (typeof LEGACY_TASK_TYPES)[number])) ? [relativePath] : [];
    });
    if (persistenceLegacyOwnershipLeaks.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: persistenceLegacyOwnershipLeaks[0]!, line: 1, severity: "fatal", message: "Persistence and Forensics ownership surfaces must not use legacy LocalAi task names as public record truth." }));
    }

    const antiEscapeViolations = aiFiles.flatMap((sourceFile) => {
      const relativePath = toRepoPath(sourceFile);
      return hasUnsafeTypeEscape(sourceFile)
        || hasCallExpression(sourceFile, "require")
        || hasDynamicImportCall(sourceFile)
        ? [relativePath]
        : [];
    });
    if (antiEscapeViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-007-V1", file: antiEscapeViolations[0]!, line: 1, severity: "fatal", message: "AI root must not use any-type escape, unknown-as laundering, require, or dynamic import escape paths." }));
    }

    const schemaRouteIsolationPassed = !hasExactLiteralValue(localTextSource, "schema_validation_only")
      && hasExactLiteralValue(taskRouterSource, "internal-schema-validator")
      && hasCallExpression(internalSchemaSource, "executeAiSchemaValidationOnly")
      && !hasCallExpressionPath(internalSchemaSource, ["context", "runtime", "execute"]);
    if (!schemaRouteIsolationPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: TASK_ROUTER_PATH, line: 1, severity: "fatal", message: "schema_validation_only must route through internal-schema-validator and must not execute through local-text-ai or LocalAiGateway." }));
    }

    const internalSchemaBoundaryPassed = !hasImportModuleSpecifier(internalSchemaSource, "local-ai-gateway")
      && !hasImportModuleSpecifier(internalSchemaSource, "lib/local-ai")
      && hasCallExpression(internalSchemaSource, "executeAiSchemaValidationOnly")
      && hasCallExpression(runtimeSchemaGateSource, "buildAiExecutionResult")
      && !hasCallExpressionPath(internalSchemaSource, ["context", "runtime", "execute"]);
    if (!internalSchemaBoundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/children/internal-schema-validator/implementation.ts`, line: 1, severity: "fatal", message: "internal-schema-validator must stay internal-only, avoid LocalAiGateway, and close through schema gate plus governed result/proof building." }));
    }

    const runtimeSplitPassed = [
      `${RUNTIME_ROOT}/ai-runtime-executor.ts`,
      `${RUNTIME_ROOT}/ai-runtime-policy-gate.ts`,
      `${RUNTIME_ROOT}/ai-runtime-quality-gate.ts`,
      `${RUNTIME_ROOT}/ai-runtime-schema-gate.ts`,
      `${RUNTIME_ROOT}/ai-runtime-failure-result.ts`,
      `${RUNTIME_ROOT}/ai-runtime-proof-builder.ts`,
      `${RUNTIME_ROOT}/ai-runtime-output-normalizer.ts`,
      `${RUNTIME_ROOT}/ai-runtime-result-builder.ts`,
    ].every((filePath) => project.getSourceFile(pathFromRepoRoot(filePath)) !== undefined)
      && !hasIdentifier(runtimeBridgeSource, "buildSchemaValidationOnlyResult")
      && !hasIdentifier(runtimeBridgeSource, "buildPolicyFailureResult")
      && !hasIdentifier(runtimeBridgeSource, "buildRuntimeFailureResult")
      && !hasIdentifier(runtimeBridgeSource, "buildRuntimeSuccessResult")
      && !hasIdentifier(runtimeBridgeSource, "buildRuntimeProof")
      && !hasIdentifier(runtimeBridgeSource, "buildResultStatus");
    if (!runtimeSplitPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-CODE-PURITY-004-V1", file: RUNTIME_BRIDGE_PATH, line: 1, severity: "error", message: "local-ai-runtime-adapter must stay bridge-sized; policy, schema, quality, failure, proof, and output normalization must remain split into dedicated runtime modules." }));
    }

    const requiredShapePassed = requiredPresence.every((entry) => entry.exists)
      && contractPassed
      && childStructurePassed
      && abilityGroupPassed
      && schemaClosurePassed
      && schemaRouteIsolationPassed
      && internalSchemaBoundaryPassed
      && runtimeSplitPassed
      && runtimePolicyGatePassed
      && runtimeSchemaGatePassed
      && runtimeFailureHandlingPassed
      && runtimeQualityGatePassed
      && invalidSchemaSuccessGuardPassed
      && runtimeProofCoveragePassed
      && dispatchFailurePassed
      && paidPolicyPassed
      && disabledChildFilesPassed;
    const forbiddenShapePassed = !runtimeTaskExists
      && !promptContractExists
      && capabilityCheckViolations.length === 0
      && forbiddenImportViolations.length === 0
      && externalChildImportViolations.length === 0
      && externalPrivateImportViolations.length === 0
      && !indexLeaks
      && verifyViolations.length === 0
      && antiEscapeViolations.length === 0;
    const boundaryPassed = sideEffectViolations.length === 0
      && !agentRuntimeLeak
      && !directTransportLeak
      && legacyLeakViolations.length === 0
      && persistenceImportLeakViolations.length === 0
      && persistenceLegacyOwnershipLeaks.length === 0;

    const localRuntime = await inspectLocalAiRuntimeBoundary();
    const multiFrame = await inspectMultiFrameAiBoundary();

    return {
      findings: [...findings, ...localRuntime.findings, ...multiFrame.findings],
      phases: [
        createPhase("ai-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "AI root exposes the required native contract, registry, router, roster, schema validation, bridge, and child implementations." : "AI root is missing required native contract shape, files, or bridge ownership."),
        createPhase("ai-forbidden-shape", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "AI root no longer contains runtime-task-execution, capability-check, verify leaks, forbidden imports, or child export escape routes." : "AI root still contains forbidden files, imports, or export leakage."),
        createPhase("ai-boundary-attack", boundaryPassed ? "PASS" : "CODE VIOLATION", boundaryPassed, boundaryPassed ? "AI group returns cognitive results only while forensics, runtime state, and legacy LocalAi ownership stay outside the public root." : "AI root still owns side effects, agent-runtime language, or legacy LocalAi leakage."),
        createPhase("ai-anti-escape", jsonExtractionPassed ? "PASS" : "CODE VIOLATION", jsonExtractionPassed, jsonExtractionPassed ? "AI JSON extraction and decisive enforcement avoid regex-based escape hatches." : "AI anti-escape checks still rely on regex-based parsing or enforcement shortcuts."),
        ...multiFrame.phases,
        ...localRuntime.phases,
      ],
    };
  },
});
