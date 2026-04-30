import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getZodObjectPropertyNames,
  hasAnyKeyword,
  hasCallExpression,
  hasCallExpressionPath,
  hasCallExpressionWithStringLiteralArgument,
  hasInterfaceMethod,
  hasStringLiteral,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/geometry-guard";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const SCHEMA_PATH = `${ROOT}/schema.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const TYPES_PATH = `${ROOT}/shared/geometry-types.ts`;
const CLOCK_PORT_PATH = `${ROOT}/ports/geometry-clock-port.ts`;
const CLOCK_PATH = `${ROOT}/runtime/geometry-clock.ts`;
const CHILD_FACTORY_PATH = `${ROOT}/runtime/geometry-child-capability.ts`;
const EXECUTOR_PATH = `${ROOT}/runtime/geometry-guard-executor.ts`;
const RESULT_BUILDER_PATH = `${ROOT}/runtime/geometry-result-builder.ts`;
const PROOF_BUILDER_PATH = `${ROOT}/runtime/geometry-proof-builder.ts`;
const REQUIRED_CHILDREN = [
  "validate-coordinate-space",
  "validate-bbox-integrity",
  "validate-click-point",
  "validate-scale-mapping",
  "map-ai-input-to-viewport",
  "map-region-to-source",
  "validate-browser-viewport-bounds",
  "validate-desktop-screen-bounds",
] as const;
const REQUIRED_FILES = [
  CONTRACT_PATH,
  SCHEMA_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  TYPES_PATH,
  `${ROOT}/shared/geometry-policy.ts`,
  `${ROOT}/shared/geometry-proof.ts`,
  `${ROOT}/shared/geometry-result.ts`,
  `${ROOT}/shared/geometry-failure.ts`,
  `${ROOT}/shared/geometry-transform.ts`,
  CLOCK_PORT_PATH,
  CLOCK_PATH,
  `${ROOT}/runtime/geometry-input-gate.ts`,
  `${ROOT}/runtime/coordinate-space-gate.ts`,
  `${ROOT}/runtime/bounds-gate.ts`,
  `${ROOT}/runtime/scale-mapping-gate.ts`,
  `${ROOT}/runtime/click-safety-gate.ts`,
  `${ROOT}/runtime/geometry-transformer.ts`,
  CHILD_FACTORY_PATH,
  `${ROOT}/runtime/geometry-dispatch-failure.ts`,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  EXECUTOR_PATH,
  `${ROOT}/children/validate-coordinate-space/implementation.ts`,
  `${ROOT}/children/validate-bbox-integrity/implementation.ts`,
  `${ROOT}/children/validate-click-point/implementation.ts`,
  `${ROOT}/children/validate-scale-mapping/implementation.ts`,
  `${ROOT}/children/map-ai-input-to-viewport/implementation.ts`,
  `${ROOT}/children/map-region-to-source/implementation.ts`,
  `${ROOT}/children/validate-browser-viewport-bounds/implementation.ts`,
  `${ROOT}/children/validate-desktop-screen-bounds/implementation.ts`,
] as const;
const FORBIDDEN_FILES = [
  `${ROOT}/shared/bounds-utils.ts`,
  `${ROOT}/shared/coordinate-space.ts`,
  `${ROOT}/shared/failure.ts`,
  `${ROOT}/shared/guard-result.ts`,
  `${ROOT}/shared/runtime-proof.ts`,
  `${ROOT}/shared/scale-mapping.ts`,
] as const;
const FORBIDDEN_IMPORT_SEGMENTS = [
  "browser/browser-controller",
  "types/platform-action",
  "types/visual-action",
  "capabilities/mouse-click",
  "mouse-click/",
  "capabilities/mouse-scroll",
  "mouse-scroll/",
  "capabilities/screenshot",
  "screenshot/",
  "capabilities/ai",
  "ai/",
  "features/platform-action",
  "local-runtime/platform-runtime-contract",
] as const;
const FORBIDDEN_IDENTIFIERS = [
  "BrowserController",
  "PlatformActionType",
  "VisualTarget",
  "GeometryGuardCoordinateActionPlan",
  "TARGET_ACTION_ALLOWLIST",
  "fallbackMode",
] as const;
const FORBIDDEN_BUSINESS_LITERALS = [
  "open_comments",
  "continue_next",
  "click_not_interested",
  "capture_video_region",
  "capture_comment_region",
  "like_or_save_candidate",
] as const;
const FORBIDDEN_DRIFT_MARKERS = ["compat", "legacy", "bridge", "geometry-guard-v2"] as const;
const REQUIRED_INPUT_FIELDS = [
  "abilityGroupId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "requestedBy",
  "purpose",
  "sourceAbilityGroupId",
  "sourceChildCapabilityId",
  "inputRef",
  "sourceScreenshotEvidenceRef",
  "sourceTargetRef",
  "sourceAiResultRef",
  "sourceCoordinateSpace",
  "requestedExecutionSpace",
  "bbox",
  "clickPoint",
  "imageSize",
  "viewportSize",
  "screenSize",
  "deviceScaleFactor",
  "scaleMapping",
  "safetyPolicy",
  "dataQualityFlags",
] as const;
const REQUIRED_SAFETY_POLICY_FIELDS = [
  "allowReviewRequired",
  "minimumConfidence",
  "coordinateConfidence",
  "requireSourceRef",
  "clickSafetyMarginPx",
  "roundingPolicy",
] as const;
const REQUIRED_RESULT_FIELDS = [
  "status",
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "geometryGuardRef",
  "guardDecision",
  "output",
  "normalizedCoordinateSpace",
  "normalizedClickPoint",
  "normalizedBbox",
  "appliedScaleMapping",
  "sourceScreenshotEvidenceRef",
  "sourceTargetRef",
  "sourceAiResultRef",
  "failureReason",
  "reviewRequiredReason",
  "debugLogRef",
  "runtimeProof",
  "policyDecision",
  "boundsDecision",
  "scaleDecision",
  "transformDecision",
  "dataQualityFlags",
  "statusMessage",
  "startedAt",
  "endedAt",
  "durationMs",
] as const;
const REQUIRED_RUNTIME_PROOF_FIELDS = [
  "proofId",
  "runId",
  "missionId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "abilityGroupId",
  "childCapabilityId",
  "sourceAbilityGroupId",
  "sourceChildCapabilityId",
  "inputRef",
  "outputRef",
  "sourceScreenshotEvidenceRef",
  "sourceTargetRef",
  "sourceAiResultRef",
  "sourceCoordinateSpace",
  "requestedExecutionSpace",
  "normalizedCoordinateSpace",
  "sourceBounds",
  "targetBounds",
  "bboxBefore",
  "bboxAfter",
  "clickPointBefore",
  "clickPointAfter",
  "scaleMappingRef",
  "deviceScaleFactor",
  "startedAt",
  "endedAt",
  "durationMs",
  "status",
  "guardDecision",
  "failureReason",
  "reviewRequiredReason",
  "policyDecision",
  "boundsDecision",
  "scaleDecision",
  "transformDecision",
  "dataQualityFlags",
] as const;
const REQUIRED_FAILURE_REASONS = [
  "input_schema_invalid",
  "unknown_child_capability",
  "click_point_in_safety_margin",
  "contact_sheet_coordinate_not_executable",
  "confidence_below_threshold",
  "source_bounds_missing",
  "target_bounds_missing",
  "source_coordinate_space_mismatch",
  "requested_execution_space_mismatch",
  "child_execution_mismatch",
  "coordinate_transform_failed",
  "output_schema_invalid",
  "runtime_exception",
] as const;
const REQUIRED_COORDINATE_SPACES = [
  "browserViewport",
  "desktopScreen",
  "imageEvidence",
  "aiInput",
  "regionCrop",
  "contactSheet",
] as const;

function getSourceFile(project: ReturnType<typeof createAuditProject>, repoRelativePath: string): SourceFile | null {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
}

function getStringLiterals(sourceFile: SourceFile): Set<string> {
  const values = new Set<string>();
  for (const node of sourceFile.getDescendants()) {
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      values.add(node.getLiteralText());
    }
  }
  return values;
}

function hasForbiddenIdentifier(sourceFile: SourceFile): boolean {
  return FORBIDDEN_IDENTIFIERS.some((identifier) => {
    return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((node) => node.getText() === identifier);
  });
}

function hasThrowStatement(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
}

function hasVerifySymbol(sourceFile: SourceFile): boolean {
  const functionNames = sourceFile.getFunctions().map((fn) => fn.getName() ?? "");
  const variableNames = sourceFile.getVariableDeclarations().map((declaration) => declaration.getName());
  return [...functionNames, ...variableNames].some((name) => name.startsWith("verify"));
}

function hasClampEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((node) => node.getText().toLowerCase().includes("clamp"))
    || hasStringLiteral(sourceFile, "clamp")
    || hasStringLiteral(sourceFile, "clamped");
}

function hasDateEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => {
      const left = expression.getExpression().getText();
      const right = expression.getName();
      return left === "Date" && (right === "parse" || right === "now");
    });
}

function hasTextEscape(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return text.includes("@ts-ignore") || text.includes("@ts-expect-error") || text.includes(" as any") || text.includes("as unknown as");
}

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport()) || /(^|\n)\s*export\s+\*/.test(sourceFile.getFullText());
}

function collectGeometryFiles(project: ReturnType<typeof createAuditProject>): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

function getImportViolations(files: SourceFile[]): string[] {
  return files.flatMap((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const specifier = declaration.getModuleSpecifierValue() ?? "";
      return FORBIDDEN_IMPORT_SEGMENTS.some((segment) => specifier.includes(segment)) ? [relativePath] : [];
    });
  });
}

function childImplementationPath(childId: typeof REQUIRED_CHILDREN[number]): string {
  return `${ROOT}/children/${childId}/implementation.ts`;
}

export const geometryGuardCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Geometry Guard Capability Owner Inspector",
  inspectorId: "geometry-guard-capability-owner",
  capabilityDomain: "geometry-guard-capability",
  inspectorEntry: "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "geometry-guard-capability law exists but production-grade coordinate-gate enforcement is not complete yet",
  implementedSummary: "geometry-guard-capability is enforced as a schema-first coordinate safety gate with AST-backed anti-escape checks",
  extraChecks: async () => {
    const project = createAuditProject();
    const geometryFiles = collectGeometryFiles(project);
    const findings: Finding[] = [];

    const requiredPresence = await Promise.all(REQUIRED_FILES.map(async (filePath) => ({
      filePath,
      exists: Boolean(getSourceFile(project, filePath)) || await fileExists(pathFromRepoRoot(filePath)),
    })));
    for (const entry of requiredPresence) {
      if (!entry.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: entry.filePath, line: 1, severity: "fatal", message: "Geometry Guard required rebuild file is missing." }));
      }
    }

    const forbiddenPresence = await Promise.all(FORBIDDEN_FILES.map(async (filePath) => ({
      filePath,
      exists: await fileExists(pathFromRepoRoot(filePath)),
    })));
    for (const entry of forbiddenPresence) {
      if (entry.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: entry.filePath, line: 1, severity: "fatal", message: "Geometry Guard old shared implementation still exists after rebuild." }));
      }
    }

    const contractSource = getSourceFile(project, CONTRACT_PATH);
    const schemaSource = getSourceFile(project, SCHEMA_PATH);
    const abilityGroupSource = getSourceFile(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFile(project, REGISTRY_PATH);
    const indexSource = getSourceFile(project, INDEX_PATH);
    const typesSource = getSourceFile(project, TYPES_PATH);
    const childFactorySource = getSourceFile(project, CHILD_FACTORY_PATH);
    const executorSource = getSourceFile(project, EXECUTOR_PATH);
    const resultBuilderSource = getSourceFile(project, RESULT_BUILDER_PATH);
    const proofBuilderSource = getSourceFile(project, PROOF_BUILDER_PATH);
    const coordinateGateSource = getSourceFile(project, `${ROOT}/runtime/coordinate-space-gate.ts`);
    const dispatchFailureSource = getSourceFile(project, `${ROOT}/runtime/geometry-dispatch-failure.ts`);
    const clockSource = getSourceFile(project, CLOCK_PATH);

    const inputFields = schemaSource ? getZodObjectPropertyNames(schemaSource, "GeometryGuardBaseInputSchema") : new Set<string>();
    const safetyPolicyFields = schemaSource ? getZodObjectPropertyNames(schemaSource, "GeometryGuardSafetyPolicySchema") : new Set<string>();
    const resultFields = schemaSource ? getZodObjectPropertyNames(schemaSource, "GeometryGuardBaseResultSchema") : new Set<string>();
    const runtimeProofFields = schemaSource ? getZodObjectPropertyNames(schemaSource, "GeometryGuardRuntimeProofSchema") : new Set<string>();
    const schemaStrings = schemaSource ? getStringLiterals(schemaSource) : new Set<string>();
    const typeStrings = typesSource ? getStringLiterals(typesSource) : new Set<string>();
    const registryStrings = registrySource ? getStringLiterals(registrySource) : new Set<string>();

    const schemaSurfacePassed = Boolean(schemaSource)
      && REQUIRED_INPUT_FIELDS.every((field) => inputFields.has(field))
      && REQUIRED_SAFETY_POLICY_FIELDS.every((field) => safetyPolicyFields.has(field))
      && REQUIRED_RESULT_FIELDS.every((field) => resultFields.has(field))
      && REQUIRED_RUNTIME_PROOF_FIELDS.every((field) => runtimeProofFields.has(field))
      && REQUIRED_CHILDREN.every((childId) => schemaStrings.has(childId))
      && REQUIRED_CHILDREN.every((childId) => typeStrings.has(childId))
      && REQUIRED_COORDINATE_SPACES.every((space) => typeStrings.has(space))
      && REQUIRED_FAILURE_REASONS.every((reason) => typeStrings.has(reason));
    if (!schemaSurfacePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: SCHEMA_PATH, line: 1, severity: "error", message: "Geometry Guard schema must define the rebuilt input, safety policy, result, runtime proof, child ids, and failure reasons." }));
    }

    const contractSurfacePassed = contractSource !== null
      && hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "execute")
      && hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "listChildCapabilityIds")
      && hasInterfaceMethod(contractSource, "GeometryGuardChildCapability", "execute")
      && !hasExportStar(contractSource);
    if (!contractSurfacePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: CONTRACT_PATH, line: 1, severity: "error", message: "Geometry Guard contract must expose only the rebuilt group and child execution surface." }));
    }

    const abilityGroupPassed = abilityGroupSource !== null
      && hasCallExpressionPath(abilityGroupSource, ["GeometryGuardAbilityInputSchema", "safeParse"])
      && hasCallExpression(abilityGroupSource, "dispatchGeometryGuardFailure")
      && !hasThrowStatement(abilityGroupSource);
    if (!abilityGroupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V2", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Geometry Guard ability-group must parse input through schema and dispatch governed failures instead of throwing." }));
    }

    const registryPassed = Boolean(registrySource)
      && REQUIRED_CHILDREN.every((childId) => registryStrings.has(childId));
    if (!registryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: REGISTRY_PATH, line: 1, severity: "error", message: "Geometry Guard registry must expose only the eight rebuilt child ids." }));
    }

    const indexPassed = indexSource !== null
      && !hasExportStar(indexSource)
      && !indexSource.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("/children/"));
    if (!indexPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: INDEX_PATH, line: 1, severity: "fatal", message: "Geometry Guard index must use explicit exports and must not leak child paths." }));
    }

    const childFactoryPassed = childFactorySource !== null
      && hasCallExpression(childFactorySource, "executeGeometryGuardChild");
    if (!childFactoryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: CHILD_FACTORY_PATH, line: 1, severity: "fatal", message: "Geometry Guard child factory must delegate into the shared executor." }));
    }

    const childImplementationViolations = REQUIRED_CHILDREN.flatMap((childId) => {
      const sourceFile = getSourceFile(project, childImplementationPath(childId));
      if (!sourceFile) {
        return [childImplementationPath(childId)];
      }

      const importSpecifiers = sourceFile.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue() ?? "");
      const directSharedImport = importSpecifiers.some((specifier) => specifier.includes("/shared/") || specifier.includes("geometry-guard-executor") || specifier.includes("guard-result") || specifier.includes("failure"));
      const factoryCall = hasCallExpressionWithStringLiteralArgument(sourceFile, ["createGeometryGuardChildCapability"], childId);
      return directSharedImport || !factoryCall ? [childImplementationPath(childId)] : [];
    });
    if (childImplementationViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: childImplementationViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard child implementations must stay as thin factory delegates with no direct validation logic." }));
    }

    const resultProofWiringPassed = resultBuilderSource !== null
      && proofBuilderSource !== null
      && hasCallExpression(resultBuilderSource, "buildGeometryRuntimeProof")
      && hasCallExpressionPath(resultBuilderSource, ["GeometryGuardAbilityResultSchema", "parse"])
      && hasCallExpressionPath(proofBuilderSource, ["GeometryGuardRuntimeProofSchema", "parse"]);
    if (!resultProofWiringPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: RESULT_BUILDER_PATH, line: 1, severity: "fatal", message: "Geometry Guard result builder must validate output schema and always build runtime proof." }));
    }

    const executorWiringPassed = executorSource !== null
      && hasCallExpression(executorSource, "evaluateGeometryInputPolicy")
      && hasCallExpression(executorSource, "evaluateCoordinateSpace")
      && hasCallExpression(executorSource, "evaluateBounds")
      && hasCallExpression(executorSource, "evaluateScaleMapping")
      && hasCallExpression(executorSource, "evaluateClickSafety")
      && hasCallExpression(executorSource, "transformGeometry")
      && hasCallExpression(executorSource, "buildGeometryGuardResult")
      && hasCallExpression(executorSource, "dispatchGeometryGuardFailure");
    if (!executorWiringPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2", file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Geometry Guard executor must own the full policy, coordinate-space, bounds, scale, click-safety, transform, and result chain." }));
    }

    const coordinateGatePassed = coordinateGateSource !== null
      && coordinateGateSource.getFullText().includes('input.sourceCoordinateSpace === "contactSheet"')
      && hasStringLiteral(coordinateGateSource, "contact_sheet_coordinate_not_executable")
      && hasStringLiteral(coordinateGateSource, "device_scale_factor_missing");
    if (!coordinateGatePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2", file: `${ROOT}/runtime/coordinate-space-gate.ts`, line: 1, severity: "fatal", message: "Geometry Guard coordinate-space gate must explicitly block contactSheet execution and enforce desktopScreen deviceScaleFactor." }));
    }

    const dispatchFailurePassed = dispatchFailureSource !== null
      && dispatchFailureSource.getFullText().includes("normalizedCoordinateSpace: null")
      && dispatchFailureSource.getFullText().includes("normalizedClickPoint: null")
      && dispatchFailureSource.getFullText().includes("normalizedBbox: null")
      && dispatchFailureSource.getFullText().includes("appliedScaleMapping: null");
    if (!dispatchFailurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2", file: `${ROOT}/runtime/geometry-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Geometry Guard failure dispatch must never emit normalized executable geometry." }));
    }

    const forbiddenImportViolations = getImportViolations(geometryFiles);
    if (forbiddenImportViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V2", file: forbiddenImportViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard imports forbidden browser, action, or cross-group execution dependencies." }));
    }

    const forbiddenIdentifierViolations = geometryFiles
      .filter((sourceFile) => hasForbiddenIdentifier(sourceFile))
      .map((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()));
    if (forbiddenIdentifierViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: forbiddenIdentifierViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard still exposes forbidden browser, visual-target, or action-plan identifiers." }));
    }

    const businessLiteralViolations = geometryFiles.map((sourceFile) => ({
      relativePath: toRepoRelativePath(sourceFile.getFilePath()),
      literals: FORBIDDEN_BUSINESS_LITERALS.filter((literal) => hasStringLiteral(sourceFile, literal)),
    })).filter((entry) => entry.literals.length > 0);
    if (businessLiteralViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: businessLiteralViolations[0]!.relativePath, line: 1, severity: "fatal", message: "Geometry Guard still contains forbidden platform-action vocabulary." }));
    }

    const geometryFilePaths = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const capabilityCheckViolations = geometryFilePaths.map((filePath) => toRepoRelativePath(filePath)).filter((filePath) => filePath.endsWith("/capability-check.ts"));
    if (capabilityCheckViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: capabilityCheckViolations[0]!, line: 1, severity: "fatal", message: "capability-check.ts must not exist inside Geometry Guard." }));
    }

    const externalChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/geometry-guard/children/") && !relativePath.startsWith(`${ROOT}/`) ? [relativePath] : [];
      });
    });
    if (externalChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: externalChildImports[0]!, line: 1, severity: "fatal", message: "Geometry Guard child implementations must not be imported outside canonical root ownership." }));
    }

    const legacyContractOwners = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === CONTRACT_PATH) {
        return [];
      }

      const duplicates = [
        sourceFile.getTypeAlias("GeometryGuardAbilityInput"),
        sourceFile.getTypeAlias("GeometryGuardAbilityResult"),
        sourceFile.getInterface("GeometryGuardAbilityGroup"),
      ].filter(Boolean);
      return duplicates.length > 0 ? [relativePath] : [];
    });
    if (legacyContractOwners.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: legacyContractOwners[0]!, line: 1, severity: "fatal", message: "Duplicate Geometry Guard contract declarations were found outside canonical contract.ts." }));
    }

    const verifyViolations = geometryFiles
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasVerifySymbol(sourceFile) }))
      .filter((entry) => entry.violates);
    if (verifyViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: verifyViolations[0]!.file, line: 1, severity: "fatal", message: "verify* functions must not exist inside Geometry Guard." }));
    }

    const clampViolations = geometryFiles
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasClampEscape(sourceFile) }))
      .filter((entry) => entry.violates);
    if (clampViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2", file: clampViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not silently clamp coordinates." }));
    }

    const throwViolations = geometryFiles
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasThrowStatement(sourceFile) }))
      .filter((entry) => entry.violates);
    if (throwViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: throwViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not throw directly; failures must be governed results." }));
    }

    const dateViolations = geometryFiles
      .filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()) !== CLOCK_PATH)
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasDateEscape(sourceFile) }))
      .filter((entry) => entry.violates);
    if (dateViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: dateViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must route time through the clock port rather than direct Date usage." }));
    }

    const clockPassed = clockSource !== null
      && hasCallExpressionPath(clockSource, ["Date", "now"]);
    if (!clockPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: CLOCK_PATH, line: 1, severity: "error", message: "Geometry Guard system clock must be the sole direct Date owner." }));
    }

    const typeEscapeViolations = geometryFiles
      .map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasAnyKeyword(sourceFile) || hasTextEscape(sourceFile) }))
      .filter((entry) => entry.violates);
    if (typeEscapeViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: typeEscapeViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not use any, ts-ignore, or unknown-as escape hatches." }));
    }

    const driftPathViolations = geometryFilePaths
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((relativePath) => FORBIDDEN_DRIFT_MARKERS.some((marker) => relativePath.toLowerCase().includes(marker)));
    if (driftPathViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: driftPathViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard must not introduce compat, legacy, bridge, or v2 paths." }));
    }

    const requiredShapePassed = requiredPresence.every((entry) => entry.exists)
      && schemaSurfacePassed
      && contractSurfacePassed
      && abilityGroupPassed
      && registryPassed
      && indexPassed
      && childFactoryPassed
      && childImplementationViolations.length === 0
      && resultProofWiringPassed
      && executorWiringPassed
      && coordinateGatePassed
      && dispatchFailurePassed;
    const forbiddenShapePassed = forbiddenPresence.every((entry) => !entry.exists)
      && forbiddenImportViolations.length === 0
      && forbiddenIdentifierViolations.length === 0
      && businessLiteralViolations.length === 0
      && externalChildImports.length === 0
      && capabilityCheckViolations.length === 0
      && indexSource !== null
      && !hasExportStar(indexSource);
    const boundaryAttackPassed = legacyContractOwners.length === 0 && childImplementationViolations.length === 0;
    const antiEscapePassed = verifyViolations.length === 0
      && clampViolations.length === 0
      && throwViolations.length === 0
      && dateViolations.length === 0
      && typeEscapeViolations.length === 0
      && driftPathViolations.length === 0
      && clockPassed;

    return {
      findings,
      phases: [
        createPhase("geometry-guard-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Geometry Guard exposes the rebuilt schema, executor chain, clock, proof builder, and thin child delegates." : "Geometry Guard required rebuild shape is incomplete or still wired to the wrong owner surface."),
        createPhase("geometry-guard-forbidden-shape", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "Geometry Guard no longer carries old shared files, child leaks, or cross-group execution imports." : "Geometry Guard still carries forbidden old files, forbidden imports, child leaks, or execution vocabulary."),
        createPhase("geometry-guard-boundary-attack", boundaryAttackPassed ? "PASS" : "CODE VIOLATION", boundaryAttackPassed, boundaryAttackPassed ? "Geometry Guard keeps one canonical contract boundary and one shared executor chain." : "Geometry Guard still shows duplicate public boundaries or child-level logic drift."),
        createPhase("geometry-guard-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Geometry Guard has no throw escape, Date escape, clamp escape, type escape, or compat drift." : "Geometry Guard still contains an escape hatch that bypasses governed validation."),
      ],
    };
  },
});