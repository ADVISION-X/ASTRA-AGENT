import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodObjectPropertyNames,
  hasCallExpression,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const ROOT = "src/capabilities/visual-target";
const CONTRACT_PATH = `${ROOT}/contract.ts`;
const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
const REGISTRY_PATH = `${ROOT}/registry.ts`;
const INDEX_PATH = `${ROOT}/index.ts`;
const PLATFORM_ADAPTER_PATH = "src/lib/local-runtime/tiktok-platform/vision-coordinate-runtime.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const LEGACY_OWNER_PATH = "src/features/platform-action/visual-target.ts";

const CHILDREN = [
  "detect-comments-button",
  "detect-not-interested-button",
  "detect-next-video-region",
  "detect-like-button",
  "detect-save-button",
  "detect-comments-panel",
  "detect-close-comments-button",
  "detect-metric-like-count",
  "detect-metric-comment-count",
] as const;

const REQUIRED_INPUT_FIELDS = [
  "childCapabilityId",
  "sessionId",
  "roundId",
  "videoVisitId",
  "targetType",
  "sourceScreenshotEvidenceId",
  "coordinateSpace",
  "sourceAiResultRef",
  "candidates",
  "requestedBy",
  "confidencePolicy",
  "selectionPolicy",
  "dataQualityPolicy",
] as const;

const REQUIRED_RESULT_FIELDS = [
  "abilityGroupId",
  "childCapabilityId",
  "status",
  "targetType",
  "sourceScreenshotEvidenceId",
  "sourceAiResultRef",
  "sourceCandidateRef",
  "coordinateSpace",
  "boundingBox",
  "clickPoint",
  "confidence",
  "requiresGeometryGuard",
  "failureReason",
  "debugLogRef",
  "dataQualityFlags",
  "startedAt",
  "endedAt",
  "durationMs",
  "createdAt",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "capabilities/screenshot",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "features/platform-action/adapters",
  "features/comments",
  "features/product-signal",
  "lib/local-ai",
] as const;

export default createPendingDomainInspector({
  inspector: "GrassEye Visual Target Capability Owner Inspector",
  inspectorId: "visual-target-capability-owner",
  capabilityDomain: "visual-target-capability",
  inspectorEntry: "scripts/audit/domains/visual-target-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "visual-target-capability law exists but execute-only ownership and cutover enforcement are incomplete",
  implementedSummary: "visual-target-capability is implemented as the canonical execute-only visual target normalization owner",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
    const platformAdapterSource = getSourceFileOrThrow(project, PLATFORM_ADAPTER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const visualTargetRootFiles = await listFilesRecursive(pathFromRepoRoot(ROOT), { extensions: [".ts"] });
    const findings: Finding[] = [];

    const inputFields = getZodObjectPropertyNames(contractSource, "VisualTargetAbilityInputSchema");
    const resultFields = getZodObjectPropertyNames(contractSource, "VisualTargetSchema");
    const exportedNames = new Set(contractSource.getExportedDeclarations().keys());
    const groupInterface = contractSource.getInterface("VisualTargetAbilityGroup");
    const groupMethods = new Set(groupInterface?.getMethods().map((method) => method.getName()) ?? []);
    const contractPassed = REQUIRED_INPUT_FIELDS.every((field) => inputFields.has(field))
      && REQUIRED_RESULT_FIELDS.every((field) => resultFields.has(field))
      && ["VisualTargetAbilityInput", "VisualTargetAbilityResult", "SuccessfulVisualTarget", "VisualTargetAbilityGroup", "VisualTargetChildCapability"].every((name) => exportedNames.has(name))
      && groupMethods.has("listChildCapabilityIds")
      && groupMethods.has("execute")
      && groupMethods.size === 2
      && Boolean(contractSource.getInterface("VisualTargetChildCapability"));
    if (!contractPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: CONTRACT_PATH, line: 1, severity: "error", message: "Visual Target contract must expose one unified input, one unified result, and one execute-only group interface." }));
    }

    const childFilesPresent = await Promise.all(
      CHILDREN.flatMap((child) => [
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/implementation.ts`)),
        fileExists(pathFromRepoRoot(`${ROOT}/children/${child}/capability-check.ts`)),
      ]),
    );
    const childStructurePassed = childFilesPresent.every(Boolean)
      && CHILDREN.every((child) => registrySource.getFullText().includes(`"${child}"`))
      && hasCallExpression(abilityGroupSource, "createVisualTargetCapabilityRegistry");
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: REGISTRY_PATH, line: 1, severity: "error", message: "Visual Target registry must keep all nine child folders with implementation.ts, capability-check.ts, and registry registration." }));
    }

    const indexExportsChildren = indexSource.getExportDeclarations().some((declaration) => (declaration.getModuleSpecifierValue() ?? "").includes("/children/"));
    if (indexExportsChildren) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: INDEX_PATH, line: 1, severity: "fatal", message: "Visual Target index must not barrel export child implementations." }));
    }

    const externalChildImports = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/visual-target/children/") && !relativePath.startsWith(`${ROOT}/`) ? [relativePath] : [];
      });
    });
    if (externalChildImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: externalChildImports[0]!, line: 1, severity: "fatal", message: "Visual Target child capabilities must not be imported outside the canonical root." }));
    }

    const forbiddenRootImports = visualTargetRootFiles.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return FORBIDDEN_IMPORT_MARKERS.some((marker) => specifier.includes(marker)) ? [toRepoRelativePath(filePath)] : [];
      });
    });
    if (forbiddenRootImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: forbiddenRootImports[0]!, line: 1, severity: "fatal", message: "Visual Target root must not import screenshot, mouse click, mouse scroll, platform adapters, comments, product-signal, or local-ai implementations." }));
    }

    const localAiImportsVisualTarget = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (!relativePath.startsWith("src/lib/local-ai/")) {
        return [];
      }

      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const specifier = declaration.getModuleSpecifierValue() ?? "";
        return specifier.includes("capabilities/visual-target") ? [relativePath] : [];
      });
    });
    if (localAiImportsVisualTarget.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-002-V1", file: localAiImportsVisualTarget[0]!, line: 1, severity: "fatal", message: "Local AI runtime must not import Visual Target capability as final target truth." }));
    }

    const duplicateContractOwners = project.getSourceFiles().flatMap((sourceFile) => {
      const relativePath = toRepoRelativePath(sourceFile.getFilePath());
      if (relativePath === CONTRACT_PATH) {
        return [];
      }

      const duplicates = [
        sourceFile.getVariableDeclaration("VisualTargetAbilityInputSchema"),
        sourceFile.getVariableDeclaration("VisualTargetSchema"),
        sourceFile.getVariableDeclaration("VisualTargetAbilityResultSchema"),
        sourceFile.getInterface("VisualTargetAbilityGroup"),
      ].filter(Boolean);
      return duplicates.length > 0 ? [relativePath] : [];
    });
    if (duplicateContractOwners.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: duplicateContractOwners[0]!, line: 1, severity: "fatal", message: "Duplicate Visual Target contract declarations were found outside canonical contract.ts." }));
    }

    const legacyOwnerExists = await fileExists(pathFromRepoRoot(LEGACY_OWNER_PATH));
    const executeOnlyConsumerPassed = platformAdapterSource.getFullText().includes("this.visualTargetAbilityGroup.execute(baseInput)")
      && !platformAdapterSource.getFullText().includes("this.visualTargetAbilityGroup.detect")
      && workbenchSource.getFullText().includes("createVisualTargetAbilityGroup()")
      && workbenchSource.getFullText().includes("this.visualTargetAbilityGroup");
    if (legacyOwnerExists || !executeOnlyConsumerPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-VISUAL-TARGET-CAPABILITY-001-V1", file: PLATFORM_ADAPTER_PATH, line: 1, severity: legacyOwnerExists ? "fatal" : "error", message: "Visual Target owner cutover must remove the legacy platform-action helper and keep platform consumers on VisualTargetAbilityGroup.execute(input) only." }));
    }

    return {
      findings,
      phases: [
        createPhase("visual-target-contract", contractPassed ? "PASS" : "CODE VIOLATION", contractPassed, contractPassed ? "Visual Target contract exposes one governed input, one governed result, and one execute-only group interface." : "Visual Target contract is missing required unified fields or execute-only interface."),
        createPhase("visual-target-child-structure", childStructurePassed && !indexExportsChildren && externalChildImports.length === 0 ? "PASS" : "CODE VIOLATION", childStructurePassed && !indexExportsChildren && externalChildImports.length === 0, childStructurePassed && !indexExportsChildren && externalChildImports.length === 0 ? "Visual Target canonical root contains all child capabilities, internal registration, and no child leakage." : "Visual Target child structure, registry, or anti-leak boundary is incomplete."),
        createPhase("visual-target-boundary-purity", forbiddenRootImports.length === 0 && localAiImportsVisualTarget.length === 0 && duplicateContractOwners.length === 0 ? "PASS" : "CODE VIOLATION", forbiddenRootImports.length === 0 && localAiImportsVisualTarget.length === 0 && duplicateContractOwners.length === 0, forbiddenRootImports.length === 0 && localAiImportsVisualTarget.length === 0 && duplicateContractOwners.length === 0 ? "Visual Target root stays pure and keeps one canonical target-truth contract." : "Visual Target root still carries forbidden coupling or duplicate target-truth drift."),
        createPhase("visual-target-owner-cutover", !legacyOwnerExists && executeOnlyConsumerPassed ? "PASS" : "CODE VIOLATION", !legacyOwnerExists && executeOnlyConsumerPassed, !legacyOwnerExists && executeOnlyConsumerPassed ? "Visual Target owner cutover is complete: legacy helper is gone, workbench wires the group, and platform adapters consume execute(input) only." : "Visual Target owner cutover is incomplete or execute-only consumption drift remains."),
      ],
    };
  },
});