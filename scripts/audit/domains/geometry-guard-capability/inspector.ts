import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasInterfaceMethod,
  hasStringLiteral,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/geometry-guard";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const REQUIRED_FILES = [
  CONTRACT_PATH,
  ABILITY_GROUP_PATH,
  REGISTRY_PATH,
  INDEX_PATH,
  `${ROOT}/shared/coordinate-space.ts`,
  `${ROOT}/shared/scale-mapping.ts`,
  `${ROOT}/shared/bounds-utils.ts`,
  `${ROOT}/shared/guard-result.ts`,
  `${ROOT}/shared/failure.ts`,
  `${ROOT}/shared/runtime-proof.ts`,
  `${ROOT}/children/validate-coordinate-space/implementation.ts`,
  `${ROOT}/children/validate-bbox-integrity/implementation.ts`,
  `${ROOT}/children/validate-click-point/implementation.ts`,
  `${ROOT}/children/validate-scale-mapping/implementation.ts`,
  `${ROOT}/children/map-ai-input-to-viewport/implementation.ts`,
  `${ROOT}/children/map-region-to-source/implementation.ts`,
  `${ROOT}/children/validate-browser-viewport-bounds/implementation.ts`,
  `${ROOT}/children/validate-desktop-screen-bounds/implementation.ts`,
] as const;
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
const FORBIDDEN_CHILDREN = [
  "plan-coordinate-action",
  "calibrate-browser-geometry",
  "verify-browser-geometry",
] as const;
const REQUIRED_INPUT_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "requestedBy",
  "purpose",
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
const REQUIRED_RESULT_FIELDS = [
  "status",
  "abilityGroupId",
  "childCapabilityId",
  "guardDecision",
  "normalizedCoordinateSpace",
  "normalizedClickPoint",
  "normalizedBbox",
  "appliedScaleMapping",
  "sourceScreenshotEvidenceRef",
  "sourceTargetRef",
  "sourceAiResultRef",
  "failureReason",
  "debugLogRef",
  "runtimeProof",
  "dataQualityFlags",
] as const;
const REQUIRED_FAILURE_REASONS = [
  "missing_requested_by",
  "missing_purpose",
  "missing_coordinate_space",
  "missing_source_ref",
  "missing_bbox",
  "invalid_bbox",
  "missing_click_point",
  "invalid_click_point",
  "click_point_outside_bbox",
  "bbox_out_of_bounds",
  "missing_scale_mapping",
  "invalid_scale_mapping",
  "contact_sheet_coordinate_not_executable",
  "ai_input_mapping_required",
  "region_mapping_required",
  "execution_space_missing",
  "device_scale_factor_missing",
  "geometry_review_required",
] as const;
const REQUIRED_COORDINATE_SPACES = [
  "browserViewport",
  "desktopScreen",
  "imageEvidence",
  "aiInput",
  "regionCrop",
  "contactSheet",
] as const;
const FORBIDDEN_IMPORT_SEGMENTS = [
  "browser/browser-controller",
  "types/platform-action",
  "types/visual-action",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/screenshot",
  "capabilities/ai",
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

export default createPendingDomainInspector({
  inspector: "GrassEye Geometry Guard Capability Owner Inspector",
  inspectorId: "geometry-guard-capability-owner",
  capabilityDomain: "geometry-guard-capability",
  inspectorEntry: "scripts/audit/domains/geometry-guard-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "geometry-guard-capability law exists but clean coordinate-gate enforcement is not complete yet",
  implementedSummary: "geometry-guard-capability is enforced as a clean coordinate safety gate with AST-backed anti-escape checks",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const geometryFiles = collectGeometryFiles(project);
    const findings: Finding[] = [];

    const requiredPresence = await Promise.all(REQUIRED_FILES.map(async (filePath) => {
      const absolutePath = pathFromRepoRoot(filePath);
      const sourceFile = project.getSourceFile(absolutePath);
      return {
        filePath,
        exists: Boolean(sourceFile) || await fileExists(absolutePath),
      };
    }));
    for (const entry of requiredPresence) {
      if (!entry.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: entry.filePath, line: 1, severity: "fatal", message: "Geometry Guard required shape file is missing." }));
      }
    }

    const forbiddenChildPaths = await Promise.all(FORBIDDEN_CHILDREN.map(async (childId) => ({ childId, exists: await fileExists(pathFromRepoRoot(`${ROOT}/children/${childId}`)) })));
    for (const entry of forbiddenChildPaths) {
      if (entry.exists) {
        findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: `${ROOT}/children/${entry.childId}`, line: 1, severity: "fatal", message: "Forbidden Geometry Guard child root still exists." }));
      }
    }

    const geometryFilePaths = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const capabilityCheckViolations = geometryFilePaths.map((filePath) => toRepoRelativePath(filePath)).filter((filePath) => filePath.endsWith("/capability-check.ts"));
    if (capabilityCheckViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: capabilityCheckViolations[0]!, line: 1, severity: "fatal", message: "capability-check.ts must not survive under Geometry Guard." }));
    }

    const inputFields = getTypeAliasPropertyNames(contractSource, "GeometryGuardAbilityInput");
    const resultFields = getTypeAliasPropertyNames(contractSource, "GeometryGuardAbilityResult");
    const contractStrings = getStringLiterals(contractSource);
    const contractPassed = REQUIRED_INPUT_FIELDS.every((field) => inputFields.has(field))
      && REQUIRED_RESULT_FIELDS.every((field) => resultFields.has(field))
      && REQUIRED_FAILURE_REASONS.every((reason) => contractStrings.has(reason))
      && REQUIRED_COORDINATE_SPACES.every((space) => contractStrings.has(space))
      && hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "execute")
      && hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "listChildCapabilityIds")
      && !hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "calibrateGeometry")
      && !hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "verifyGeometry")
      && !hasInterfaceMethod(contractSource, "GeometryGuardAbilityGroup", "planCoordinateAction");
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: CONTRACT_PATH, line: 1, severity: "error", message: "Geometry Guard contract must expose the clean coordinate-gate input, result, failure reasons, and public interface." }));
    }

    const registryStrings = getStringLiterals(registrySource);
    const childStructurePassed = REQUIRED_CHILDREN.every((childId) => registryStrings.has(childId))
      && FORBIDDEN_CHILDREN.every((childId) => !registryStrings.has(childId));
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: REGISTRY_PATH, line: 1, severity: "error", message: "Geometry Guard registry must expose only the eight approved child ids." }));
    }

    const indexExportsChildren = indexSource.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("/children/"));
    if (indexExportsChildren) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: INDEX_PATH, line: 1, severity: "fatal", message: "Geometry Guard index must not barrel export child implementations." }));
    }

    const forbiddenImportViolations = getImportViolations(geometryFiles);
    if (forbiddenImportViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V2", file: forbiddenImportViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard root imports forbidden browser, platform-action, visual-action, or cross-group execution dependencies." }));
    }

    const forbiddenIdentifierViolations = geometryFiles
      .filter((sourceFile) => hasForbiddenIdentifier(sourceFile))
      .map((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()));
    if (forbiddenIdentifierViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: forbiddenIdentifierViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard still exposes forbidden BrowserController, PlatformActionType, VisualTarget, action-plan, or fallback identifiers." }));
    }

    const businessLiteralViolations = geometryFiles.map((sourceFile) => ({
      relativePath: toRepoRelativePath(sourceFile.getFilePath()),
      literals: FORBIDDEN_BUSINESS_LITERALS.filter((literal) => hasStringLiteral(sourceFile, literal)),
    })).filter((entry) => entry.literals.length > 0);
    if (businessLiteralViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: businessLiteralViolations[0]!.relativePath, line: 1, severity: "fatal", message: "Geometry Guard still contains forbidden platform action vocabulary." }));
    }

    const verifyViolations = geometryFiles.map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasVerifySymbol(sourceFile) })).filter((entry) => entry.violates);
    if (verifyViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: verifyViolations[0]!.file, line: 1, severity: "fatal", message: "verify* functions must not exist inside Geometry Guard." }));
    }

    const clampViolations = geometryFiles.map((sourceFile) => ({ file: toRepoRelativePath(sourceFile.getFilePath()), violates: hasClampEscape(sourceFile) })).filter((entry) => entry.violates);
    if (clampViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-003-V2", file: clampViolations[0]!.file, line: 1, severity: "fatal", message: "Geometry Guard must not silently clamp coordinates." }));
    }

    const externalChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/geometry-guard/children/") && !relativePath.startsWith(`${ROOT}/`) ? [relativePath] : [];
      });
    });
    if (externalChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-001-V2", file: externalChildImports[0]!, line: 1, severity: "fatal", message: "Geometry Guard child implementations must not be imported outside the canonical root." }));
    }

    const legacyContractOwners = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === CONTRACT_PATH) {
        return [];
      }
      const duplicates = [
        sourceFile.getTypeAlias("GeometryGuardAbilityInput"),
        sourceFile.getTypeAlias("GeometryGuardAbilityResult"),
      ].filter(Boolean);
      return duplicates.length > 0 ? [relativePath] : [];
    });
    if (legacyContractOwners.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-002-V2", file: legacyContractOwners[0]!, line: 1, severity: "fatal", message: "Duplicate Geometry Guard contract declarations were found outside canonical contract.ts." }));
    }

    const abilityGroupText = abilityGroupSource.getFullText();
    const abilityGroupPassed = !abilityGroupText.includes("browserController")
      && !abilityGroupText.includes("calibrate-browser-geometry")
      && !abilityGroupText.includes("verify-browser-geometry")
      && !abilityGroupText.includes("plan-coordinate-action");
    if (!abilityGroupPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-004-V2", file: ABILITY_GROUP_PATH, line: 1, severity: "fatal", message: "Geometry Guard ability-group must not require BrowserController or old child entrypoints." }));
    }

    const driftPathViolations = geometryFilePaths.map((filePath) => toRepoRelativePath(filePath)).filter((relativePath) => {
      return FORBIDDEN_DRIFT_MARKERS.some((marker) => relativePath.toLowerCase().includes(marker));
    });
    if (driftPathViolations.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-GEOMETRY-GUARD-CAPABILITY-005-V2", file: driftPathViolations[0]!, line: 1, severity: "fatal", message: "Geometry Guard must not introduce compat, legacy, bridge, or v2 paths." }));
    }

    const requiredShapePassed = requiredPresence.every((entry) => entry.exists) && contractPassed && childStructurePassed && abilityGroupPassed;
    const forbiddenShapePassed = forbiddenChildPaths.every((entry) => !entry.exists)
      && capabilityCheckViolations.length === 0
      && forbiddenImportViolations.length === 0
      && forbiddenIdentifierViolations.length === 0
      && businessLiteralViolations.length === 0
      && verifyViolations.length === 0
      && externalChildImports.length === 0
      && !indexExportsChildren;
    const boundaryAttackPassed = legacyContractOwners.length === 0;
    const antiEscapePassed = clampViolations.length === 0 && driftPathViolations.length === 0;

    return {
      findings,
      phases: [
        createPhase("geometry-guard-required-shape", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Geometry Guard exposes the clean eight-child contract, canonical shared files, and public group entry." : "Geometry Guard required shape is incomplete or still carries old entrypoints."),
        createPhase("geometry-guard-forbidden-shape", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "Geometry Guard no longer imports browser or action owners, leaks child paths, or exposes old action-plan surface." : "Geometry Guard still carries forbidden imports, child roots, action-plan surface, or execution vocabulary."),
        createPhase("geometry-guard-boundary-attack", boundaryAttackPassed ? "PASS" : "CODE VIOLATION", boundaryAttackPassed, boundaryAttackPassed ? "Geometry Guard keeps one canonical contract and no duplicate public boundary." : "Geometry Guard still shows duplicate boundary surface or legacy contract drift."),
        createPhase("geometry-guard-anti-escape", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Geometry Guard has no clamp escape, compat path, bridge path, or silent second system." : "Geometry Guard still contains clamp escape or compat-style drift."),
      ],
    };
  },
});