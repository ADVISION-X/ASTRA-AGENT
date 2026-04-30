import { Node, SyntaxKind, type ArrayLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasAnyKeyword,
  hasCallExpression,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const AI_ROOT = "src/capabilities/ai";
const INSPECTOR_ENTRY = "scripts/audit/domains/ai-capability/inspector.ts";
const NEGATIVE_PROOF_HARNESS = "scripts/audit/domains/ai-capability/negative-proof-harness.ts";
const TS_IGNORE_MARK = `@ts-${"ignore"}`;
const TS_EXPECT_ERROR_MARK = `@ts-${"expect-error"}`;
const ESLINT_DISABLE_MARK = `eslint-${"disable"}`;

const REQUIRED_FILES = [
  `${AI_ROOT}/ability-group.ts`,
  `${AI_ROOT}/contract.ts`,
  `${AI_ROOT}/schema.ts`,
  `${AI_ROOT}/registry.ts`,
  `${AI_ROOT}/index.ts`,
  `${AI_ROOT}/task-router.ts`,
  `${AI_ROOT}/model-roster.ts`,
  `${AI_ROOT}/ports/ai-clock-port.ts`,
  `${AI_ROOT}/ports/ai-runtime-port.ts`,
  `${AI_ROOT}/ports/ai-model-roster-port.ts`,
  `${AI_ROOT}/ports/ai-prompt-registry-port.ts`,
  `${AI_ROOT}/runtime/ai-executor.ts`,
  `${AI_ROOT}/runtime/ai-input-gate.ts`,
  `${AI_ROOT}/runtime/ai-provider-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-data-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-cost-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-safety-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-schema-gate.ts`,
  `${AI_ROOT}/runtime/ai-quality-gate.ts`,
  `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`,
  `${AI_ROOT}/runtime/ai-result-builder.ts`,
  `${AI_ROOT}/runtime/ai-proof-builder.ts`,
  `${AI_ROOT}/runtime/ai-dispatch-failure.ts`,
  `${AI_ROOT}/runtime/ai-disabled-provider-result.ts`,
  `${AI_ROOT}/runtime/ai-clock.ts`,
  `${AI_ROOT}/runtime/ai-idempotency.ts`,
  `${AI_ROOT}/runtime/ai-timeout-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-payload-budget-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-health-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-call-runner.ts`,
  `${AI_ROOT}/runtime/ai-execution-context.ts`,
  `${AI_ROOT}/runtime/ai-prompt-registry.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`,
  `${AI_ROOT}/shared/ai-types.ts`,
  `${AI_ROOT}/shared/ai-policy.ts`,
  `${AI_ROOT}/shared/ai-proof.ts`,
  `${AI_ROOT}/shared/ai-failure.ts`,
  `${AI_ROOT}/shared/ai-json-extract.ts`,
  `${AI_ROOT}/shared/ai-output.ts`,
  NEGATIVE_PROOF_HARNESS,
] as const;

const CHILD_IDS = [
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

const FORBIDDEN_FILES = [
  `${AI_ROOT}/schema-validation.ts`,
  `${AI_ROOT}/shared/ai-runtime-proof.ts`,
  `${AI_ROOT}/runtime/ai-runtime-executor.ts`,
  `${AI_ROOT}/runtime/ai-runtime-policy-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-quality-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-schema-gate.ts`,
  `${AI_ROOT}/runtime/ai-runtime-failure-result.ts`,
  `${AI_ROOT}/runtime/ai-runtime-proof-builder.ts`,
  `${AI_ROOT}/runtime/ai-runtime-output-normalizer.ts`,
  `${AI_ROOT}/runtime/ai-runtime-result-builder.ts`,
  `${AI_ROOT}/runtime-adapters/local-ai-runtime-bridge.ts`,
  `${AI_ROOT}/capability-check.ts`,
] as const;

const FORBIDDEN_IMPORT_SEGMENTS = [
  "capabilities/open",
  "capabilities/screenshot",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/geometry-guard",
  "capabilities/page-state",
  "capabilities/forensics-persistence",
  "features/platform-action",
  "computer-use",
  "forensics",
] as const;

function getAiSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${AI_ROOT}/`));
}

function getSourceOrThrow(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

function getArrayStringLiterals(sourceFile: SourceFile, variableName: string): string[] {
  const variable = sourceFile.getVariableDeclaration(variableName);
  const initializer = variable?.getInitializer();
  if (!initializer) {
    return [];
  }

  let arrayLiteral: ArrayLiteralExpression | null = null;
  if (Node.isArrayLiteralExpression(initializer)) {
    arrayLiteral = initializer;
  } else if (Node.isAsExpression(initializer)) {
    const expression = initializer.getExpression();
    if (Node.isArrayLiteralExpression(expression)) {
      arrayLiteral = expression;
    }
  }

  if (!arrayLiteral) {
    return [];
  }
  return arrayLiteral.getElements().flatMap((element) => (Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
}

function getReturnArrayLiterals(sourceFile: SourceFile, functionName: string): string[] {
  const fn = sourceFile.getFunction(functionName);
  const returned = fn?.getDescendantsOfKind(SyntaxKind.ReturnStatement).find((statement) => Node.isArrayLiteralExpression(statement.getExpression()));
  const arrayLiteral = returned?.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!arrayLiteral) {
    return [];
  }
  return arrayLiteral.getElements().flatMap((element) => (Node.isStringLiteral(element) ? [element.getLiteralText()] : []));
}

function getObjectPropertyStringArray(sourceFile: SourceFile, variableName: string): string[] {
  const variable = sourceFile.getVariableDeclaration(variableName);
  const initializer = variable?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  if (!initializer) {
    return [];
  }

  const values: string[] = [];
  for (const property of initializer.getProperties()) {
    if (!Node.isPropertyAssignment(property)) {
      continue;
    }
    const value = property.getInitializerIfKind(SyntaxKind.StringLiteral);
    if (value) {
      values.push(value.getLiteralText());
    }
  }

  return values;
}

function hasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  if (hasAnyKeyword(sourceFile)) {
    return true;
  }

  for (const expression of sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression)) {
    const text = expression.getTypeNode()?.getText() ?? "";
    const inner = expression.getExpression();
    if (text === "any") {
      return true;
    }
    if (Node.isAsExpression(inner) && inner.getTypeNode()?.getText() === "unknown") {
      return true;
    }
    if (Node.isCallExpression(inner)) {
      const callPath = inner.getExpression().getText();
      if (callPath === "JSON.parse") {
        return true;
      }
    }
  }

  return sourceFile.getDescendants().some((node) => {
    const commentText = [
      ...node.getLeadingCommentRanges(),
      ...node.getTrailingCommentRanges(),
    ].map((comment) => comment.getText()).join("\n");
    return commentText.includes(TS_IGNORE_MARK)
      || commentText.includes(TS_EXPECT_ERROR_MARK)
      || commentText.includes(ESLINT_DISABLE_MARK);
  });
}

function hasDynamicImportOrRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword || expression.getText() === "require";
  });
}

function hasForbiddenRecordAssertion(sourceFile: SourceFile, repoPath: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => {
    const typeText = expression.getTypeNode()?.getText() ?? "";
    if (typeText !== "Record<string, unknown>") {
      return false;
    }
    return repoPath !== `${AI_ROOT}/runtime/ai-dispatch-failure.ts`
      || expression.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration)?.getName() !== "readFailureEnvelopeRawRecord";
  });
}

function hasStringLiteral(sourceFile: SourceFile, value: string): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === value);
}

function hasChildLocalSchemaShape(sourceFile: SourceFile, childNamePrefix: string): boolean {
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys());
  return exportedNames.has(`${childNamePrefix}ChildInputSchema`)
    && exportedNames.has(`${childNamePrefix}ChildResultSchema`)
    && (
      exportedNames.has(`${childNamePrefix}ChildExecutionPolicySchema`)
      || exportedNames.has(`${childNamePrefix}ChildRuntimePolicySchema`)
    )
    && sourceFile.getExportDeclarations().length === 0;
}

function hasChildContractShape(sourceFile: SourceFile, childNamePrefix: string): boolean {
  const exportedNames = new Set(sourceFile.getExportedDeclarations().keys());
  return [...exportedNames].some((name) => name.endsWith("_CHILD_ID"))
    && exportedNames.has(`${childNamePrefix}ChildContract`)
    && exportedNames.has(`${childNamePrefix}ChildExecutionPolicy`)
    && sourceFile.getExportDeclarations().length === 0;
}

function hasGovernedFailureStatusBranch(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) => {
    const implementationStatusProperty = objectLiteral.getProperty("implementationStatus");
    if (!implementationStatusProperty || !Node.isPropertyAssignment(implementationStatusProperty)) {
      return false;
    }
    const implementationStatus = implementationStatusProperty.getInitializerIfKind(SyntaxKind.StringLiteral);
    if (!implementationStatus || implementationStatus.getLiteralText() !== "governed_output_rejected") {
      return false;
    }
    const statusProperty = objectLiteral.getProperty("status");
    if (!statusProperty || !Node.isPropertyAssignment(statusProperty)) {
      return false;
    }
    const initializer = statusProperty.getInitializer();
    return Boolean(
      initializer
      && Node.isConditionalExpression(initializer)
      && initializer.getWhenTrue().getText().includes('"review_required"')
      && initializer.getWhenFalse().getText().includes('"failed"'),
    );
  });
}

function getReferencesCount(sourceFile: SourceFile, name: string): number {
  const declaration =
    sourceFile.getFunction(name)
    ?? sourceFile.getVariableDeclaration(name)
    ?? sourceFile.getExportedDeclarations().get(name)?.at(0)
    ?? null;

  if (!declaration) {
    return 0;
  }

  const referenceNode = Node.isVariableDeclaration(declaration)
    ? declaration.getNameNode()
    : "getNameNode" in declaration && typeof declaration.getNameNode === "function"
      ? declaration.getNameNode()
      : declaration;

  if (Node.isIdentifier(referenceNode)) {
    return referenceNode.findReferencesAsNodes().length;
  }
  return 0;
}

export default createPendingDomainInspector({
  inspector: "GrassEye AI Capability Owner Inspector",
  inspectorId: "ai-capability-owner",
  capabilityDomain: "ai-capability",
  inspectorEntry: INSPECTOR_ENTRY,
  ownedPaths: [AI_ROOT],
  pendingSummary: "ai-capability static package is not established",
  implementedSummary: "ai-capability is rebuilt as a static capability package with ts-morph enforced runtime gates",
  extraChecks: async () => {
    const project = createAuditProject();
    const findings: Finding[] = [];

    const schemaSource = getSourceOrThrow(project, `${AI_ROOT}/schema.ts`);
    const typesSource = getSourceOrThrow(project, `${AI_ROOT}/shared/ai-types.ts`);
    const abilityGroupSource = getSourceOrThrow(project, `${AI_ROOT}/ability-group.ts`);
    const registrySource = getSourceOrThrow(project, `${AI_ROOT}/registry.ts`);
    const routerSource = getSourceOrThrow(project, `${AI_ROOT}/task-router.ts`);
    const modelRosterSource = getSourceOrThrow(project, `${AI_ROOT}/model-roster.ts`);
    const indexSource = getSourceOrThrow(project, `${AI_ROOT}/index.ts`);
    const executorSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-executor.ts`);
    const proofBuilderSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-proof-builder.ts`);
    const resultBuilderSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-result-builder.ts`);
    const adapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
    const aiSources = getAiSources(project);

    for (const requiredFile of REQUIRED_FILES) {
      if (!(await fileExists(pathFromRepoRoot(requiredFile)))) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: requiredFile, line: 1, severity: "fatal", message: "Required AI canonical file is missing." }));
      }
    }

    for (const childId of CHILD_IDS) {
      for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"] as const) {
        const filePath = `${AI_ROOT}/children/${childId}/${suffix}`;
        if (!(await fileExists(pathFromRepoRoot(filePath)))) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: filePath, line: 1, severity: "fatal", message: "AI child package is incomplete; contract/schema/implementation are all required." }));
        }
      }
      const childNamePrefix = childId
        .split("-")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("");
      const childSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/schema.ts`);
      const childContractSource = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/contract.ts`);
      if (!hasChildLocalSchemaShape(childSchemaSource, childNamePrefix)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/children/${childId}/schema.ts`, line: 1, severity: "fatal", message: "AI child schema must be child-local and must not be a parent-schema re-export shell." }));
      }
      if (!hasChildContractShape(childContractSource, childNamePrefix)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/children/${childId}/contract.ts`, line: 1, severity: "fatal", message: "AI child contract must define child id, execution policy, and concrete contract locally." }));
      }
    }

    for (const forbiddenFile of FORBIDDEN_FILES) {
      if (await fileExists(pathFromRepoRoot(forbiddenFile))) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: forbiddenFile, line: 1, severity: "fatal", message: "Forbidden retired AI residue must remain deleted." }));
      }
    }

    const schemaChildIds = getArrayStringLiterals(typesSource, "AI_CHILD_CAPABILITY_IDS");
    const registryChildIds = getReturnArrayLiterals(registrySource, "listAiChildren");
    const routedChildIds = getObjectPropertyStringArray(routerSource, "AI_TASK_ROUTING");
    const rosterChildIds = modelRosterSource.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((literal) => literal.getLiteralText())
      .filter((value) => CHILD_IDS.includes(value as (typeof CHILD_IDS)[number]));

    const normalizedExpected = [...CHILD_IDS].sort().join(",");
    if (schemaChildIds.sort().join(",") !== normalizedExpected) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/schema.ts`, line: 1, severity: "fatal", message: "AiChildCapabilityIdSchema must match the governed child package set." }));
    }
    if (registryChildIds.sort().join(",") !== normalizedExpected) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/registry.ts`, line: 1, severity: "fatal", message: "listAiChildren must match the governed child package set." }));
    }
    if ([...new Set(routedChildIds)].sort().join(",") !== ["internal-schema-validator", "local-ocr-ai", "local-text-ai", "local-vision-ai"].sort().join(",")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/task-router.ts`, line: 1, severity: "fatal", message: "AI task router must only route to governed enabled children." }));
    }
    if ([...new Set(rosterChildIds)].sort().join(",") !== normalizedExpected) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/model-roster.ts`, line: 1, severity: "fatal", message: "AI model roster must enumerate the same governed child package set." }));
    }

    const requiredExecutorCalls = [
      "parseAiExecutorInput",
      "evaluateAiProviderPolicy",
      "evaluateAiDataPolicy",
      "evaluateAiCostPolicy",
      "evaluateAiPayloadBudgetGate",
      "evaluateAiRuntimeHealthGate",
      "runAiRuntimeCall",
      "evaluateAiSafetyPolicy",
      "resolveAiSchemaContract",
      "validateAiInternalCandidate",
      "buildAiDisabledProviderOutput",
      "evaluateAiOutputBoundary",
      "evaluateAiQualityGate",
      "buildAiResult",
    ];
    for (const callName of requiredExecutorCalls) {
      if (!hasCallExpression(executorSource, callName)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-executor.ts`, line: 1, severity: "fatal", message: `AI executor must route through ${callName}.` }));
      }
    }
    if (!hasGovernedFailureStatusBranch(executorSource)) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-executor.ts`, line: 1, severity: "fatal", message: "AI executor must keep schema/policy/quality rejection paths governed as review_required or failed, never clean success." }));
    }
    if (executorSource.getText().includes("context.runtime.execute(")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-executor.ts`, line: 1, severity: "fatal", message: "AI executor must call runtime only through ai-runtime-call-runner." }));
    }

    const dispatchFailureSource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-dispatch-failure.ts`);
    if (!dispatchFailureSource.getExportedDeclarations().has("dispatchAiFailure") || !dispatchFailureSource.getImportDeclarations().some((declaration) => declaration.getNamedImports().some((named) => named.getName() === "AiDispatchFailureEnvelopeSchema"))) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-dispatch-failure.ts`, line: 1, severity: "fatal", message: "AI dispatch failure must build a governed dispatch failure envelope." }));
    }

    for (const fakeLiteral of ["invalid-session", "invalid://input", "future-disabled"]) {
      for (const sourceFile of aiSources) {
        const repoPath = toRepoRelativePath(sourceFile.getFilePath());
        if (hasStringLiteral(sourceFile, fakeLiteral)) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: repoPath, line: 1, severity: "fatal", message: `AI package must not contain fake failure proof literal ${fakeLiteral}.` }));
        }
      }
    }

    const futureSchemaSource = getSourceOrThrow(project, `${AI_ROOT}/children/future-api-ai/schema.ts`);
    if (futureSchemaSource.getVariableDeclaration("FutureApiAiSchemaPlaceholder")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/children/future-api-ai/schema.ts`, line: 1, severity: "fatal", message: "future-api-ai schema must not be a placeholder." }));
    }

    const futureImplementationSource = getSourceOrThrow(project, `${AI_ROOT}/children/future-api-ai/implementation.ts`);
    if (hasCallExpression(futureImplementationSource, "executeAiChild") || futureImplementationSource.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: `${AI_ROOT}/children/future-api-ai/implementation.ts`, line: 1, severity: "fatal", message: "future-api-ai must remain non-executable while disabled." }));
    }

    const outputBoundarySource = getSourceOrThrow(project, `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`);
    if (!hasCallExpression(outputBoundarySource, "safeParse") || !hasImportModuleSpecifier(outputBoundarySource, "schema")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must include a schema-level forbidden action output gate." }));
    }
    if (!hasCallExpression(outputBoundarySource, "collectForbiddenFields") || !outputBoundarySource.getVariableDeclaration("FORBIDDEN_OUTPUT_KEYS")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/runtime/ai-output-boundary-gate.ts`, line: 1, severity: "fatal", message: "AI output boundary must recursively reject forbidden action output fields and aliases." }));
    }
    if (hasCallExpression(schemaSource, "passthrough")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema.ts`, line: 1, severity: "fatal", message: "AI forbidden action output schema must not use passthrough." }));
    }

    if (!hasCallExpression(abilityGroupSource, "parseAiInput") || !hasCallExpression(abilityGroupSource, "createAiCapabilityRegistry") || !hasCallExpression(abilityGroupSource, "routeAiTaskToChild")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must stay thin and route through parse, registry, router, and child execution only." }));
    }
    for (const forbiddenThinEntryImport of ["local-ai-runtime-adapter", "model-roster", "ai-prompt-registry", "ai-clock"]) {
      if (hasImportModuleSpecifier(abilityGroupSource, forbiddenThinEntryImport)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must not assemble runtime, roster, prompt registry, or clock directly." }));
      }
    }

    if (abilityGroupSource.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: `${AI_ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "AI ability-group must not allocate time outside the clock port." }));
    }

    if (indexSource.getExportDeclarations().some((declaration) => declaration.isNamespaceExport())) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/index.ts`, line: 1, severity: "fatal", message: "AI index must not use export-star barrels." }));
    }
    const publicAbilityGroup = indexSource.getExportedDeclarations().get("AiAbilityGroup")?.at(0);
    if (publicAbilityGroup && Node.isInterfaceDeclaration(publicAbilityGroup)) {
      const publicMethods = publicAbilityGroup.getMethods().map((method) => method.getName());
      for (const forbiddenMethod of ["getPromptContract", "getModelRoster"]) {
        if (publicMethods.includes(forbiddenMethod)) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/contract.ts`, line: 1, severity: "fatal", message: "AI public ability-group contract must not leak prompt or model-roster internals." }));
        }
      }
    }

    for (const sourceFile of aiSources) {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath !== `${AI_ROOT}/runtime/ai-clock.ts` && hasNewDateOutsideClock(sourceFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package must source time exclusively from ai-clock-port." }));
      }
      if (hasForbiddenEscape(sourceFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package contains forbidden type-escape or suppression syntax." }));
      }
      if (hasForbiddenRecordAssertion(sourceFile, repoPath)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "Record<string, unknown> assertions are only allowed inside the dispatch failure envelope raw parser." }));
      }
      if (hasDynamicImportOrRequire(sourceFile)) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package must not use dynamic import or require." }));
      }
      for (const forbiddenImport of FORBIDDEN_IMPORT_SEGMENTS) {
        if (hasImportModuleSpecifier(sourceFile, forbiddenImport)) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "AI capability boundary must not import platform-action or action-capability owners." }));
        }
      }
      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        const resolved = importDeclaration.getModuleSpecifierSourceFile();
        if (!resolved) {
          continue;
        }
        const resolvedPath = toRepoRelativePath(resolved.getFilePath());
        if (
          resolvedPath.startsWith("src/capabilities/open/")
          || resolvedPath.startsWith("src/capabilities/screenshot/")
          || resolvedPath.startsWith("src/capabilities/mouse-click/")
          || resolvedPath.startsWith("src/capabilities/mouse-scroll/")
          || resolvedPath.startsWith("src/capabilities/geometry-guard/")
          || resolvedPath.startsWith("src/capabilities/page-state/")
          || resolvedPath.startsWith("src/capabilities/forensics-persistence/")
        ) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "AI capability boundary must not resolve imports into action-capability owners." }));
          break;
        }
      }
    }

    for (const childId of ["internal-schema-validator", "paid-vision-ai", "paid-analysis-ai", "future-api-ai"] as const) {
      const source = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/implementation.ts`);
      if (hasImportModuleSpecifier(source, "local-ai-gateway")) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: `${AI_ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Internal/paid/future children must not import LocalAiGateway." }));
      }
    }
    for (const childId of ["paid-vision-ai", "paid-analysis-ai", "future-api-ai"] as const) {
      const source = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/implementation.ts`);
      if (source.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute") || hasCallExpression(source, "executeAiChild")) {
        findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: `${AI_ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Disabled AI children must not expose execute or call executor." }));
      }
    }

    if (!hasImportModuleSpecifier(adapterSource, "local-ai-gateway")) {
      findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-AI-RUNTIME-001-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI gateway access must stay isolated inside the local runtime adapter." }));
    }
    for (const requiredAdapterToken of ["AbortController", "MAX_CONCURRENT_RUNS", "circuitBreaker", "rawOutputRef", "rawOutputHash", "gatewayDurationMs", "modelHealthBefore", "modelHealthAfter", "runtimeCallId", "timeoutMs"]) {
      if (!adapterSource.getText().includes(requiredAdapterToken)) {
        findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: `Local AI adapter must preserve ${requiredAdapterToken} protection/evidence.` }));
      }
    }
    for (const sourceFile of aiSources) {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      if (repoPath !== `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts` && hasImportModuleSpecifier(sourceFile, "local-ai-gateway")) {
        findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-AI-RUNTIME-001-V1", file: repoPath, line: 1, severity: "fatal", message: "LocalAiGateway must not be imported outside the AI local runtime adapter." }));
      }
    }
    if (!schemaSource.getText().includes("failed and review_required result output must be null") || !schemaSource.getText().includes("success result requires confidence")) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: `${AI_ROOT}/schema.ts`, line: 1, severity: "fatal", message: "AI result schema must reject failed/review output and success without confidence." }));
    }

    const projectSources = project.getSourceFiles();
    for (const sourceFile of projectSources) {
      const repoPath = toRepoRelativePath(sourceFile.getFilePath());
      const allowedOwner = repoPath.startsWith(`${AI_ROOT}/`) || repoPath.startsWith("scripts/audit/domains/ai-capability/");
      if (allowedOwner) {
        continue;
      }

      for (const importDeclaration of sourceFile.getImportDeclarations()) {
        let specifier = "";
        try {
          specifier = importDeclaration.getModuleSpecifierValue();
        } catch {
          continue;
        }
        if (specifier.includes("capabilities/ai/children/") || specifier.includes("capabilities/ai/runtime/")) {
          findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "External modules must not import AI children or runtime internals." }));
          break;
        }
      }
    }

    if (getReferencesCount(proofBuilderSource, "buildAiRuntimeProof") < 2) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-proof-builder.ts`, line: 1, severity: "fatal", message: "AI proof builder must be referenced by the governed result path." }));
    }
    if (getReferencesCount(resultBuilderSource, "buildAiResult") < 2) {
      findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-002-V1", file: `${AI_ROOT}/runtime/ai-result-builder.ts`, line: 1, severity: "fatal", message: "AI result builder must be referenced by executor and failure paths." }));
    }

    return { findings };
  },
});
