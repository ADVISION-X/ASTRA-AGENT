import { Node, SyntaxKind, type ImportDeclaration, type Project, type SourceFile, type TypeChecker } from "ts-morph";

import { fileExists, listFilesRecursive, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { DomainManifest, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import {
  createAuditProject,
  flattenPropertyAccess,
  getSourceFileOrThrow,
  hasAnyKeyword,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const CAPABILITY_DOMAIN = "visual-target-capability";
const INSPECTOR_ID = "visual-target-capability-owner";
const INSPECTOR_ENTRY = "scripts/audit/domains/visual-target-capability/inspector.ts";
const MANIFEST_PATH = "scripts/audit/domains/visual-target-capability/manifest.json";

const ROOT = "src/capabilities/visual-target";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const PLATFORM_ADAPTER_PATH = "src/lib/local-runtime/tiktok-platform/vision-coordinate-runtime.ts";
const LEGACY_OWNER_PATH = "src/features/platform-action/visual-target.ts";

const CHILDREN = [
  "detect-like-button",
  "detect-save-button",
  "detect-comments-button",
  "detect-comments-panel",
  "detect-close-comments-button",
  "detect-not-interested-button",
  "detect-next-video-region",
  "detect-metric-like-count",
  "detect-metric-comment-count",
] as const;

const REQUIRED_ROOT_FILES = [
  CONTRACT_PATH,
  SCHEMA_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  `${ROOT}/ports/visual-target-clock-port.ts`,
  `${ROOT}/ports/visual-target-profile-port.ts`,
  `${ROOT}/shared/visual-target-candidate.ts`,
  `${ROOT}/shared/visual-target-failure.ts`,
  `${ROOT}/shared/visual-target-policy.ts`,
  `${ROOT}/shared/visual-target-profile.ts`,
  `${ROOT}/shared/visual-target-proof.ts`,
  `${ROOT}/shared/visual-target-result.ts`,
  `${ROOT}/shared/visual-target-types.ts`,
  `${ROOT}/runtime/ai-result-proof-gate.ts`,
  `${ROOT}/runtime/ambiguity-gate.ts`,
  `${ROOT}/runtime/candidate-source-gate.ts`,
  `${ROOT}/runtime/coordinate-space-gate.ts`,
  `${ROOT}/runtime/page-state-consistency-gate.ts`,
  `${ROOT}/runtime/screenshot-proof-gate.ts`,
  `${ROOT}/runtime/target-selection-gate.ts`,
  `${ROOT}/runtime/target-type-policy-gate.ts`,
  `${ROOT}/runtime/visual-target-clock.ts`,
  `${ROOT}/runtime/visual-target-dispatch-failure.ts`,
  `${ROOT}/runtime/visual-target-executor.ts`,
  `${ROOT}/runtime/visual-target-input-gate.ts`,
  `${ROOT}/runtime/visual-target-proof-builder.ts`,
  `${ROOT}/runtime/visual-target-result-builder.ts`,
  `${ROOT}/runtime/visual-target-time.ts`,
] as const;

const FORBIDDEN_FILES = [
  `${ROOT}/target-profiles.ts`,
  `${ROOT}/target-selection.ts`,
  `${ROOT}/platform-target-profiles.ts`,
  `${ROOT}/shared/confidence-policy.ts`,
  `${ROOT}/shared/target-result.ts`,
  `${ROOT}/shared/target-validation.ts`,
  LEGACY_OWNER_PATH,
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/screenshot",
  "capabilities/geometry-guard",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/forensics-persistence",
  "capabilities/ai",
  "lib/local-ai",
] as const;

const REQUIRED_INPUT_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "requestedBy",
  "sourceAbilityGroupId",
  "sourceChildCapabilityId",
  "inputRef",
  "targetType",
  "targetNature",
  "sourceProof",
  "candidates",
] as const;

const REQUIRED_BASE_RESULT_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "targetNature",
  "status",
  "sessionId",
  "roundId",
  "videoVisitId",
  "targetType",
  "targetId",
  "sourceScreenshotEvidenceId",
  "sourceScreenshotProofRef",
  "sourceAiResultRef",
  "sourceAiProofRef",
  "sourcePageStateProofRef",
  "sourceCandidateRef",
  "coordinateSpace",
  "boundingBox",
  "clickPoint",
  "executableCoordinate",
  "confidence",
  "requiresGeometryGuard",
  "geometryGuardHandoffRequired",
  "actionable",
  "failureReason",
  "reviewRequiredReason",
  "statusMessage",
  "debugLogRef",
  "dataQualityFlags",
  "startedAt",
  "endedAt",
  "createdAt",
  "durationMs",
] as const;

const REQUIRED_RUNTIME_PROOF_FIELDS = [
  "proofId",
  "runId",
  "missionId",
  "sessionId",
  "inputRef",
  "outputRef",
  "screenshotEvidenceId",
  "screenshotProofRef",
  "pageStateProofRef",
  "selectedTargetType",
  "candidateCount",
  "coordinateSpace",
  "geometryGuardHandoffRequired",
  "status",
  "failureReason",
  "screenshotDecision",
  "aiDecision",
  "pageStateDecision",
  "candidateSourceDecision",
  "coordinateSpaceDecision",
  "targetTypeDecision",
  "selectionDecision",
  "ambiguityDecision",
  "geometryGuardHandoffPolicy",
  "clock",
] as const;

const REQUIRED_CONTRACT_EXPORTS = [
  "VISUAL_TARGET_ABILITY_GROUP_ID",
  "VisualTargetSchema",
  "VisualTargetAbilityInput",
  "ParsedVisualTargetAbilityInput",
  "VisualTargetAbilityResult",
  "VisualTargetAbilityGroup",
  "VisualTargetChildCapability",
  "SuccessfulVisualTarget",
] as const;

const REQUIRED_INDEX_EXPORTS = [
  "createVisualTargetAbilityGroup",
  "listVisualTargetChildren",
  "isSuccessfulVisualTarget",
  "VisualTargetSchema",
] as const;

const REQUIRED_INSPECTOR_FUNCTIONS = [
  "runRequiredShapeAttack",
  "runForbiddenShapeAttack",
  "runBoundaryAttack",
  "runAntiEscapeAttack",
  "runGeneratedChainCheck",
  "runManifestCheck",
  "runRunnerFailPowerCheck",
] as const;

const ALLOWED_EXTERNAL_IMPORT_SUFFIXES = ["/index.js", "/contract.js"] as const;
const ALLOWED_DATE_FILES = new Set([
  `${ROOT}/runtime/visual-target-clock.ts`,
  `${ROOT}/runtime/visual-target-time.ts`,
]);

type AttackOutcome = {
  findings: Finding[];
  phase: InspectorPhase;
};

function toLine(node: Node | undefined): number {
  return node?.getStartLineNumber() ?? 1;
}

function toRootRelative(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

function createViolation(input: {
  lawId: string;
  file: string;
  line?: number;
  severity?: "error" | "fatal";
  message: string;
  detail?: string | undefined;
  hint?: string | undefined;
}): Finding {
  return createFinding({
    lawId: input.lawId,
    file: input.file,
    line: input.line ?? 1,
    severity: input.severity ?? "error",
    message: input.message,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
    ...(input.hint === undefined ? {} : { hint: input.hint }),
  });
}

function createAttackPhase(name: string, findings: Finding[], passSummary: string, failSummary: string): InspectorPhase {
  const passed = findings.length === 0;
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary);
}

function getVisualTargetSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRootRelative(sourceFile).startsWith(`${ROOT}/`));
}

function hasWildcardExport(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getNamedExports().length === 0);
}

function getIllegalDateNodes(sourceFile: SourceFile): Node[] {
  const illegalCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.length === 2 && path[0] === "Date" && path[1] === "parse";
  });
  const illegalNewExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).filter((newExpression) => {
    const expression = newExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "Date";
  });

  return [...illegalCalls, ...illegalNewExpressions];
}

function getUnknownCastEscapes(sourceFile: SourceFile): Node[] {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).filter((asExpression) => {
    const currentType = asExpression.getTypeNode()?.getText();
    if (currentType === "any") {
      return true;
    }

    const expression = asExpression.getExpression();
    return Node.isAsExpression(expression) && expression.getTypeNode()?.getText() === "unknown";
  });
}

function getDynamicImportEscapes(sourceFile: SourceFile): Node[] {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function getRequireEscapes(sourceFile: SourceFile): Node[] {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

function getCommentEscapeMarkers(sourceFile: SourceFile): string[] {
  const text = sourceFile.getFullText();
  return ["@ts-ignore", "@ts-expect-error", "eslint-disable"].filter((marker) => text.includes(marker));
}

function extractImportResolutionDetail(typeChecker: TypeChecker, declaration: ImportDeclaration): string | undefined {
  const targetNode = declaration.getDefaultImport() ?? declaration.getNamespaceImport() ?? declaration.getNamedImports()[0]?.getNameNode();
  if (!targetNode) {
    return undefined;
  }

  const symbol = typeChecker.getSymbolAtLocation(targetNode);
  if (!symbol) {
    return undefined;
  }

  const aliasedSymbol = symbol.getAliasedSymbol();
  const referenceNodes = Node.isIdentifier(targetNode) ? targetNode.findReferencesAsNodes() : [];
  const referencePaths = [...new Set<string>(referenceNodes.map((node) => toRootRelative(node.getSourceFile())))].sort((left, right) => left.localeCompare(right));
  return `symbol=${symbol.getName()} aliased=${aliasedSymbol?.getName() ?? "none"} refs=${referencePaths.join(", ")}`;
}

function hasCoordinateSpaceExclusion(sourceFile: SourceFile, schemaName: string, exclusions: readonly string[]): boolean {
  const declaration = sourceFile.getVariableDeclaration(schemaName);
  if (!declaration) {
    return false;
  }

  return declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "exclude") {
      return false;
    }
    if (expression.getExpression().getText() !== "VisualTargetCoordinateSpaceSchema") {
      return false;
    }

    const [firstArgument] = callExpression.getArguments();
    if (!firstArgument || !Node.isArrayLiteralExpression(firstArgument)) {
      return false;
    }

    const values = new Set(
      firstArgument
        .getElements()
        .filter((element) => Node.isStringLiteral(element))
        .map((element) => element.getLiteralText()),
    );

    return exclusions.every((value) => values.has(value));
  });
}

function getObjectLiteralPropertyNames(node: Node | undefined): Set<string> {
  if (!node || !Node.isObjectLiteralExpression(node)) {
    return new Set();
  }

  return new Set(
    node.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }
      return [];
    }),
  );
}

function collectZodShapePropertyNames(node: Node | undefined): Set<string> {
  if (!node) {
    return new Set();
  }
  if (!Node.isCallExpression(node)) {
    return new Set();
  }

  const expression = node.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    if (expression.getName() === "strict" || expression.getName() === "superRefine") {
      return collectZodShapePropertyNames(expression.getExpression());
    }

    if (expression.getName() === "extend") {
      const base = collectZodShapePropertyNames(expression.getExpression());
      const extension = getObjectLiteralPropertyNames(node.getArguments()[0]);
      for (const propertyName of extension) {
        base.add(propertyName);
      }
      return base;
    }
  }

  return getObjectLiteralPropertyNames(node.getArguments()[0]);
}

function getZodShapePropertyNames(sourceFile: SourceFile, declarationName: string): Set<string> {
  return collectZodShapePropertyNames(sourceFile.getVariableDeclaration(declarationName)?.getInitializer());
}

async function runRequiredShapeAttack(project: Project): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const missingFiles: string[] = [];

  for (const filePath of REQUIRED_ROOT_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missingFiles.push(filePath);
    }
  }
  for (const childCapabilityId of CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"] as const) {
      const filePath = `${ROOT}/children/${childCapabilityId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        missingFiles.push(filePath);
      }
    }
  }
  if (missingFiles.length > 0) {
    findings.push(createViolation({
      lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1",
      file: missingFiles[0]!,
      severity: "fatal",
      message: "Visual Target required-shape is incomplete.",
      detail: `Missing files: ${missingFiles.join(", ")}`,
    }));
  }

  const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
  const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
  const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
  const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
  const indexSource = getSourceFileOrThrow(project, INDEX_PATH);

  const inputFields = getZodShapePropertyNames(schemaSource, "VisualTargetAbilityInputSchema");
  const baseResultFields = getZodShapePropertyNames(schemaSource, "VisualTargetBaseResultSchema");
  const runtimeProofFields = getZodShapePropertyNames(schemaSource, "VisualTargetRuntimeProofSchema");
  for (const field of REQUIRED_INPUT_FIELDS) {
    if (!inputFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: SCHEMA_PATH, message: `VisualTargetAbilityInputSchema is missing ${field}.` }));
    }
  }
  for (const field of REQUIRED_BASE_RESULT_FIELDS) {
    if (!baseResultFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: SCHEMA_PATH, message: `VisualTargetBaseResultSchema is missing ${field}.` }));
    }
  }
  for (const field of REQUIRED_RUNTIME_PROOF_FIELDS) {
    if (!runtimeProofFields.has(field)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: SCHEMA_PATH, message: `VisualTargetRuntimeProofSchema is missing ${field}.` }));
    }
  }

  const contractExports = new Set(contractSource.getExportedDeclarations().keys());
  for (const exportName of REQUIRED_CONTRACT_EXPORTS) {
    if (!contractExports.has(exportName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: CONTRACT_PATH, message: `Visual Target contract must export ${exportName}.` }));
    }
  }

  const abilityGroupInterface = contractSource.getInterface("VisualTargetAbilityGroup");
  const abilityGroupMethods = new Set(abilityGroupInterface?.getMethods().map((method) => method.getName()) ?? []);
  if (!abilityGroupInterface || abilityGroupMethods.size !== 2 || !abilityGroupMethods.has("listChildCapabilityIds") || !abilityGroupMethods.has("execute")) {
    findings.push(createViolation({
      lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1",
      file: CONTRACT_PATH,
      line: toLine(abilityGroupInterface ?? contractSource),
      message: "VisualTargetAbilityGroup must stay execute-only with listChildCapabilityIds() and execute().",
    }));
  }

  if (!abilityGroupSource.getFunction("createVisualTargetAbilityGroup")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: ABILITY_GROUP_PATH, message: "Visual Target must expose createVisualTargetAbilityGroup()." }));
  }
  if (!registrySource.getFunction("createVisualTargetCapabilityRegistry") || !registrySource.getFunction("listVisualTargetChildren")) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: REGISTRY_PATH, message: "Visual Target registry must expose createVisualTargetCapabilityRegistry() and listVisualTargetChildren()." }));
  }

  const indexExports = new Set(indexSource.getExportedDeclarations().keys());
  for (const exportName of REQUIRED_INDEX_EXPORTS) {
    if (!indexExports.has(exportName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: INDEX_PATH, message: `Visual Target index must export ${exportName}.` }));
    }
  }

  for (const childCapabilityId of CHILDREN) {
    const registryImportsChild = registrySource.getImportDeclarations().some((declaration) => {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      return specifier.includes(`/children/${childCapabilityId}/implementation.js`);
    });
    if (!registryImportsChild) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: REGISTRY_PATH, message: `Visual Target registry is missing ${childCapabilityId}.` }));
    }
    const implementationSource = getSourceFileOrThrow(project, `${ROOT}/children/${childCapabilityId}/implementation.ts`);
    const usesExecutor = implementationSource.getImportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").endsWith("/runtime/visual-target-executor.js"));
    if (!usesExecutor) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: `${ROOT}/children/${childCapabilityId}/implementation.ts`, message: `Child ${childCapabilityId} must route through the governed runtime executor.` }));
    }
  }

  for (const schemaName of [
    "VisualTargetActionSuccessResultSchema",
    "VisualTargetRegionSuccessResultSchema",
    "VisualTargetMetricSuccessResultSchema",
  ] as const) {
    if (!hasCoordinateSpaceExclusion(schemaSource, schemaName, ["contact_sheet"])) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: SCHEMA_PATH, message: `${schemaName} must exclude contact_sheet from success coordinateSpace.` }));
    }
  }
  if (!hasCoordinateSpaceExclusion(schemaSource, "VisualTargetActionSuccessResultSchema", ["ai_input"])) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: SCHEMA_PATH, message: "VisualTargetActionSuccessResultSchema must exclude ai_input from actionable success coordinateSpace." }));
  }

  return {
    findings,
    phase: createAttackPhase(
      "required-shape-attack",
      findings,
      "Visual Target required-shape is present: standard package files, child triplets, execute-only contract, and governed schemas all exist.",
      "Visual Target required-shape is incomplete or drifted from the standard package contract.",
    ),
  };
}

async function runForbiddenShapeAttack(project: Project): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const rootFiles = getVisualTargetSourceFiles(project);
  const rootPaths = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });

  for (const forbiddenPath of FORBIDDEN_FILES) {
    if (await fileExists(pathFromRepoRoot(forbiddenPath))) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: forbiddenPath, severity: "fatal", message: `Forbidden legacy file still exists: ${forbiddenPath}` }));
    }
  }
  for (const filePath of rootPaths) {
    const relativePath = toRepoRelativePath(filePath);
    if (relativePath.endsWith("capability-check.ts")) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use capability-check.ts pseudo-acceptance files." }));
    }
  }

  for (const sourceFile of rootFiles) {
    const relativePath = toRootRelative(sourceFile);

    if (hasWildcardExport(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use export * barrel exports." }));
    }
    for (const declaration of sourceFile.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      if (FORBIDDEN_IMPORT_MARKERS.some((marker) => specifier.includes(marker))) {
        findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, line: toLine(declaration), severity: "fatal", message: `Visual Target imported forbidden owner surface ${specifier}.` }));
      }
    }

    const forbiddenOwnerAccess = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).find((expression) => {
      const path = flattenPropertyAccess(expression);
      return path[0] === "screenshotAbilityGroup"
        || path[0] === "geometryGuardAbilityGroup"
        || path[0] === "mouseClickAbilityGroup"
        || path[0] === "mouseScrollAbilityGroup"
        || path[0] === "forensicsPersistenceAbilityGroup";
    });
    if (forbiddenOwnerAccess) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: relativePath, line: toLine(forbiddenOwnerAccess), severity: "fatal", message: "Visual Target must not call or hold foreign owner ability groups directly." }));
    }
  }

  return {
    findings,
    phase: createAttackPhase(
      "forbidden-shape-attack",
      findings,
      "Visual Target forbidden legacy files, foreign-owner imports, capability-check shims, and barrel exports are absent.",
      "Visual Target still contains forbidden legacy files, foreign-owner imports, or escape-friendly export shapes.",
    ),
  };
}

async function runBoundaryAttack(project: Project, typeChecker: TypeChecker): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const platformAdapterSource = getSourceFileOrThrow(project, PLATFORM_ADAPTER_PATH);

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRootRelative(sourceFile);
    if (relativePath.startsWith(`${ROOT}/`)) {
      continue;
    }

    for (const declaration of sourceFile.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      if (!specifier.includes("capabilities/visual-target/")) {
        continue;
      }

      const allowed = ALLOWED_EXTERNAL_IMPORT_SUFFIXES.some((suffix) => specifier.endsWith(suffix));
      if (allowed) {
        continue;
      }

      findings.push(createViolation({
        lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1",
        file: relativePath,
        line: toLine(declaration),
        severity: "fatal",
        message: `External code must not import Visual Target internal surface ${specifier}.`,
        detail: extractImportResolutionDetail(typeChecker, declaration),
        hint: "Consume Visual Target only through contract.ts or index.ts.",
      }));
    }
  }

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRootRelative(sourceFile);
    if (relativePath === CONTRACT_PATH || relativePath === SCHEMA_PATH) {
      continue;
    }

    const duplicateNodes = [
      sourceFile.getVariableDeclaration("VisualTargetAbilityInputSchema"),
      sourceFile.getVariableDeclaration("VisualTargetBaseResultSchema"),
      sourceFile.getVariableDeclaration("VisualTargetRuntimeProofSchema"),
      sourceFile.getInterface("VisualTargetAbilityGroup"),
    ].flatMap((node) => node ? [node] : []);
    if (duplicateNodes.length > 0) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: relativePath, line: toLine(duplicateNodes[0]), severity: "fatal", message: "Visual Target canonical contract/schema symbols must not be redeclared outside contract.ts or schema.ts." }));
    }
  }

  const workbenchImport = workbenchSource.getImportDeclarations().find((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("capabilities/visual-target/index.js"));
  const workbenchCreatesAbilityGroup = workbenchSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.length === 1 && path[0] === "createVisualTargetAbilityGroup";
  });
  if (!workbenchImport || !workbenchCreatesAbilityGroup) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: WORKBENCH_PATH, message: "Workbench must wire Visual Target through createVisualTargetAbilityGroup() from the public index surface." }));
  }

  const adapterUsesExecuteOnly = platformAdapterSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const path = flattenPropertyAccess(callExpression.getExpression());
    return path.join(".") === "this.visualTargetAbilityGroup.execute";
  });
  if (!adapterUsesExecuteOnly) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: PLATFORM_ADAPTER_PATH, message: "TikTok runtime must consume Visual Target through visualTargetAbilityGroup.execute()." }));
  }

  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRootRelative(sourceFile);
    if (!relativePath.startsWith("src/lib/local-ai/")) {
      continue;
    }

    const declaration = sourceFile.getImportDeclarations().find((candidate) => (candidate.getModuleSpecifierValue() ?? "").includes("capabilities/visual-target"));
    if (declaration) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1", file: relativePath, line: toLine(declaration), severity: "fatal", message: "Local AI runtime must not import Visual Target as final target-truth owner." }));
    }
  }

  return {
    findings,
    phase: createAttackPhase(
      "boundary-attack",
      findings,
      "Visual Target ownership boundary holds: consumers stay on contract/index, workbench owns creation, and no duplicate owner surfaces exist.",
      "Visual Target ownership boundary is leaking through internal imports, duplicate contracts, or non-public creation/consumption paths.",
    ),
  };
}

async function runAntiEscapeAttack(project: Project): Promise<AttackOutcome> {
  const findings: Finding[] = [];

  for (const sourceFile of getVisualTargetSourceFiles(project)) {
    const relativePath = toRootRelative(sourceFile);

    if (hasAnyKeyword(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, severity: "fatal", message: "Visual Target must not use any." }));
    }
    for (const node of getUnknownCastEscapes(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use as any or as unknown as escape casts." }));
    }
    for (const node of getDynamicImportEscapes(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use dynamic import escapes." }));
    }
    for (const node of getRequireEscapes(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not use require escapes." }));
    }
    for (const marker of getCommentEscapeMarkers(sourceFile)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, severity: "fatal", message: `Visual Target must not include ${marker}.` }));
    }
    if (!ALLOWED_DATE_FILES.has(relativePath)) {
      for (const node of getIllegalDateNodes(sourceFile)) {
        findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: relativePath, line: toLine(node), severity: "fatal", message: "Visual Target must not scatter new Date or Date.parse outside the dedicated clock/time helpers." }));
      }
    }
  }

  return {
    findings,
    phase: createAttackPhase(
      "anti-escape-attack",
      findings,
      "Visual Target anti-escape guard is clean: no any, no double-cast escapes, no dynamic loading, and no scattered Date parsing.",
      "Visual Target anti-escape guard detected type escapes, comment suppressions, dynamic loading, or scattered Date parsing.",
    ),
  };
}

async function runGeneratedChainCheck(context: InspectorContext): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const matrixOwner = context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN);
  const planOwner = context.planOwnersByDomain.get(CAPABILITY_DOMAIN);
  const manifestOwner = context.manifestsByDomain.get(CAPABILITY_DOMAIN);

  if (!matrixOwner || matrixOwner.inspectorId !== INSPECTOR_ID || matrixOwner.entry !== INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: MANIFEST_PATH, message: "Generated enforcement matrix must resolve visual-target-capability to this inspector entry." }));
  }
  if (!planOwner || planOwner.inspectorId !== INSPECTOR_ID) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: MANIFEST_PATH, message: "Generated audit plan must retain visual-target-capability ownership for this inspector." }));
  }
  if (!manifestOwner || manifestOwner.entry !== INSPECTOR_ENTRY) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: MANIFEST_PATH, message: "Resolved manifest ownership drifted away from this inspector entry." }));
  }

  return {
    findings,
    phase: createAttackPhase(
      "generated-chain-check",
      findings,
      "Visual Target stays connected to the generated audit chain through manifest, enforcement matrix, and audit plan ownership.",
      "Visual Target manifest or generated audit ownership chain drifted away from this inspector.",
    ),
  };
}

async function runManifestCheck(): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const manifest = await readJsonFile<DomainManifest>(pathFromRepoRoot(MANIFEST_PATH));

  if (!manifest.owner || manifest.inspectorId !== INSPECTOR_ID || manifest.entry !== INSPECTOR_ENTRY || manifest.capabilityDomain !== CAPABILITY_DOMAIN) {
    findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: MANIFEST_PATH, message: "Visual Target manifest must declare the canonical owner inspector, domain, and entry." }));
  }
  for (const lawId of [
    "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1",
    "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1",
    "GRASSEYE-VISUAL-TARGET-CAPABILITY-003-V1",
    "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1",
  ] as const) {
    if (!manifest.allowedLawIds.includes(lawId)) {
      findings.push(createViolation({ lawId, file: MANIFEST_PATH, message: `Visual Target manifest must include ${lawId} in allowedLawIds.` }));
    }
  }

  return {
    findings,
    phase: createAttackPhase(
      "manifest-check",
      findings,
      "Visual Target manifest points at the canonical owner inspector and preserves the expected law binding set.",
      "Visual Target manifest drifted from the canonical owner entry or allowed law binding set.",
    ),
  };
}

async function runRunnerFailPowerCheck(project: Project): Promise<AttackOutcome> {
  const findings: Finding[] = [];
  const inspectorSource = getSourceFileOrThrow(project, INSPECTOR_ENTRY);
  const functionNames = new Set(inspectorSource.getFunctions().map((fn) => fn.getName()).filter((name): name is string => Boolean(name)));

  for (const functionName of REQUIRED_INSPECTOR_FUNCTIONS) {
    if (!functionNames.has(functionName)) {
      findings.push(createViolation({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-004-V1", file: INSPECTOR_ENTRY, message: `Visual Target inspector must declare ${functionName}().` }));
    }
  }

  return {
    findings,
    phase: createAttackPhase(
      "runner-fail-power-check",
      findings,
      "Visual Target inspector retains explicit attack-function structure, so audit failures remain attributable and reviewable.",
      "Visual Target inspector lost its explicit attack-function structure and risks silent enforcement drift.",
    ),
  };
}

export default createPendingDomainInspector({
  inspector: "GrassEye Visual Target Capability Owner Inspector",
  inspectorId: INSPECTOR_ID,
  capabilityDomain: CAPABILITY_DOMAIN,
  inspectorEntry: INSPECTOR_ENTRY,
  ownedPaths: [ROOT],
  pendingSummary: "visual-target-capability law exists but production-grade owner enforcement is incomplete",
  implementedSummary: "visual-target-capability is implemented as the canonical governed visual target owner with ts-morph attack enforcement",
  extraChecks: async (context) => {
    const project = createAuditProject();
    const typeChecker = project.getTypeChecker();
    const outcomes = await Promise.all([
      runRequiredShapeAttack(project),
      runForbiddenShapeAttack(project),
      runBoundaryAttack(project, typeChecker),
      runAntiEscapeAttack(project),
      runGeneratedChainCheck(context),
      runManifestCheck(),
      runRunnerFailPowerCheck(project),
    ]);

    return {
      findings: outcomes.flatMap((outcome) => outcome.findings),
      phases: outcomes.map((outcome) => outcome.phase),
    };
  },
});
