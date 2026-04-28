import path from "node:path";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasInterfaceMethod,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectMultiFrameScreenshotBoundary } from "../multi-frame-evidence/inspector.js";

const LAW_ID = "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1";
const SCREENSHOT_ROOT = "src/capabilities/screenshot";
const LEGACY_SCREENSHOT_ROOT = "src/features/platform-action/screenshot-drawer";
const CONTRACT_PATH = "src/capabilities/screenshot/contract.ts";
const ABILITY_GROUP_PATH = "src/capabilities/screenshot/ability-group.ts";
const REGISTRY_PATH = "src/capabilities/screenshot/registry.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
const AGENT_SERVICE_PATH = "src/lib/local-runtime/runtime-executor.ts";
const VISION_ADAPTER_PATH = "src/lib/local-runtime/tiktok-platform/vision-coordinate-runtime.ts";
const TIKTOK_ADAPTER_PATH = "src/lib/local-runtime/tiktok-platform/runtime.ts";
const OLLAMA_ADAPTER_PATH = "src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts";

const CHILDREN = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

const REQUIRED_RESULT_FIELDS = [
  "status",
  "abilityGroupId",
  "childCapabilityId",
  "evidenceId",
  "storageRef",
  "pageUrl",
  "pageTitle",
  "width",
  "height",
  "originalWidth",
  "originalHeight",
  "imageKind",
  "coordinateSpace",
  "scaleMapping",
  "sourceScreenshotEvidenceId",
  "screenId",
  "sourceHash",
  "outputHash",
  "failureReason",
  "dataQualityFlags",
  "createdAt",
  "durationMs",
  "browserCapture",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "lib/mission-runtime",
  "comments",
  "product-signal",
  "platform-action/adapters",
  "local-ai/runtime-adapters",
  "capabilities/open",
];

const FORBIDDEN_FILE_NAME_MARKERS = ["compat", "legacy", "bridge", "drawer"];

export default createPendingDomainInspector({
  inspector: "GrassEye Screenshot Capability Owner Inspector",
  inspectorId: "screenshot-capability-owner",
  capabilityDomain: "screenshot-capability",
  inspectorEntry: "scripts/audit/domains/screenshot-capability/inspector.ts",
  ownedPaths: [SCREENSHOT_ROOT],
  pendingSummary: "screenshot-capability law exists but canonical screenshot root is not fully established yet",
  implementedSummary: "screenshot-capability is implemented as a canonical ability group with child capabilities and direct enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
    const visionAdapterSource = getSourceFileOrThrow(project, VISION_ADAPTER_PATH);
    const tiktokAdapterSource = getSourceFileOrThrow(project, TIKTOK_ADAPTER_PATH);
    const ollamaAdapterSource = getSourceFileOrThrow(project, OLLAMA_ADAPTER_PATH);

    const findings: Finding[] = [];
    const screenshotRootFiles = await listFilesRecursive(pathFromRepoRoot(SCREENSHOT_ROOT), { extensions: [".ts"] });
    const legacyRootExists = await fileExists(pathFromRepoRoot(LEGACY_SCREENSHOT_ROOT));
    const illegalAgentRuntimeExists = await fileExists(pathFromRepoRoot(AGENT_SERVICE_PATH));

    const inputProps = getTypeAliasPropertyNames(contractSource, "ScreenshotAbilityInput");
    const resultProps = getTypeAliasPropertyNames(contractSource, "ScreenshotAbilityResult");
    const contractPassed = [
      inputProps.has("childCapabilityId"),
      inputProps.has("source"),
      inputProps.has("region"),
      inputProps.has("requestedBy"),
      inputProps.has("purpose"),
      ...REQUIRED_RESULT_FIELDS.map((field) => resultProps.has(field)),
      Boolean(contractSource.getInterface("ScreenshotChildCapability")),
      Boolean(contractSource.getInterface("ScreenshotAbilityGroup")),
    ].every(Boolean);
    if (!contractPassed) {
      findings.push(createFinding({ lawId: LAW_ID, file: CONTRACT_PATH, line: 1, severity: "error", message: "Screenshot capability contract must expose one unified input, one unified result, and ability-group-level interfaces." }));
    }

    const childFilesPresent = await Promise.all(
      CHILDREN.flatMap((child) => [
        fileExists(pathFromRepoRoot(`${SCREENSHOT_ROOT}/children/${child}/implementation.ts`)),
        fileExists(pathFromRepoRoot(`${SCREENSHOT_ROOT}/children/${child}/capability-check.ts`)),
      ]),
    );
    const childStructurePassed = childFilesPresent.every(Boolean)
      && CHILDREN.every((child) => registrySource.getFullText().includes(`"${child}"`));
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1", file: REGISTRY_PATH, line: 1, severity: "error", message: "Screenshot ability group must keep five child folders with implementation.ts, capability-check.ts, and registry registration." }));
    }

    const forbiddenRootImports = screenshotRootFiles.flatMap((filePath) => {
      const repoRelativePath = toRepoRelativePath(filePath);
      const sourceFile = project.getSourceFile(filePath) ?? project.getSourceFile(pathFromRepoRoot(repoRelativePath));
      if (!sourceFile) {
        return [];
      }

      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const moduleSpecifier = declaration.getModuleSpecifierValue();
        return FORBIDDEN_IMPORT_MARKERS.some((marker) => moduleSpecifier.includes(marker)) ? [repoRelativePath] : [];
      });
    });
    if (forbiddenRootImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-002-V1", file: forbiddenRootImports[0]!, line: 1, severity: "fatal", message: "Screenshot root must not import agent, comments, product-signal, platform-action adapter implementations, local-ai runtime adapters, or open capability implementations." }));
    }

    const rootNamingPassed = screenshotRootFiles.every((filePath) => !FORBIDDEN_FILE_NAME_MARKERS.some((marker) => path.basename(filePath).includes(marker)));
    if (!rootNamingPassed) {
      findings.push(createFinding({ lawId: LAW_ID, file: SCREENSHOT_ROOT, line: 1, severity: "error", message: "Screenshot capability root must not keep compat, legacy, bridge, or drawer file names." }));
    }

    const abilityGroupPassed = hasInterfaceMethod(contractSource, "ScreenshotAbilityGroup", "execute")
      && abilityGroupSource.getFullText().includes("createScreenshotCapabilityRegistry")
      && abilityGroupSource.getFullText().includes("capture-browser-viewport")
      && abilityGroupSource.getFullText().includes("prepare-ai-input");
    if (!abilityGroupPassed) {
      findings.push(createFinding({ lawId: LAW_ID, file: ABILITY_GROUP_PATH, line: 1, severity: "error", message: "Screenshot ability group must execute through registry-backed child capability resolution." }));
    }

    const runtimeBoundaryPassed = workbenchSource.getFullText().includes("capabilities/screenshot")
      && !workbenchSource.getFullText().includes("screenshot-drawer")
      && !visionAdapterSource.getFullText().includes("ScreenCaptureController")
      && visionAdapterSource.getFullText().includes("screenshotAbilityGroup.captureBrowserViewport")
      && tiktokAdapterSource.getFullText().includes("capabilities/screenshot/contract")
      && !illegalAgentRuntimeExists;
    if (!runtimeBoundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1", file: WORKBENCH_PATH, line: 1, severity: "error", message: "Runtime must consume Screenshot Ability Group directly and must not keep legacy screenshot-drawer or ScreenCaptureController wiring." }));
    }

    if (illegalAgentRuntimeExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1", file: AGENT_SERVICE_PATH, line: 1, severity: "fatal", message: "Illegal local-runtime executor must be physically removed after Screenshot capability cutover." }));
    }

    const localAiBoundaryPassed = !ollamaAdapterSource.getFullText().includes("runCommand(")
      && !ollamaAdapterSource.getFullText().includes("sips")
      && ollamaAdapterSource.getFullText().includes("Screenshot Ability Group prepare-ai-input");
    if (!localAiBoundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1", file: OLLAMA_ADAPTER_PATH, line: 1, severity: "fatal", message: "Local AI runtime adapter must not hide screenshot resize or crop behavior; oversized vision inputs must require upstream Screenshot Ability Group prepare-ai-input." }));
    }

    if (legacyRootExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1", file: LEGACY_SCREENSHOT_ROOT, line: 1, severity: "fatal", message: "Legacy src/features/platform-action/screenshot-drawer root must be physically removed after migration." }));
    }

    const multiFrame = await inspectMultiFrameScreenshotBoundary();

    return {
      findings: [...findings, ...multiFrame.findings],
      phases: [
        createPhase("screenshot-contract", contractPassed ? "PASS" : "CODE VIOLATION", contractPassed, contractPassed ? "Screenshot contract exposes one governed input and one governed result shape." : "Screenshot contract is missing required unified input or result fields."),
        createPhase("screenshot-child-structure", childStructurePassed && abilityGroupPassed ? "PASS" : "CODE VIOLATION", childStructurePassed && abilityGroupPassed, childStructurePassed && abilityGroupPassed ? "Canonical screenshot root contains five child capabilities, a registry, and an ability-group entry." : "Screenshot child structure or ability-group wiring is incomplete."),
        createPhase("screenshot-boundary-purity", forbiddenRootImports.length === 0 && rootNamingPassed && localAiBoundaryPassed ? "PASS" : "CODE VIOLATION", forbiddenRootImports.length === 0 && rootNamingPassed && localAiBoundaryPassed, forbiddenRootImports.length === 0 && rootNamingPassed && localAiBoundaryPassed ? "Screenshot root stays pure and local AI no longer hides screenshot transforms." : "Screenshot root still carries forbidden coupling, drawer naming drift, or hidden local-AI screenshot behavior."),
        createPhase("screenshot-owner-cutover", runtimeBoundaryPassed && !legacyRootExists ? "PASS" : "CODE VIOLATION", runtimeBoundaryPassed && !legacyRootExists, runtimeBoundaryPassed && !legacyRootExists ? "Screenshot owner cutover is complete: runtime consumes the ability group directly and the legacy root is gone." : "Screenshot owner cutover is incomplete or legacy escape paths remain."),
        ...multiFrame.phases,
      ],
    };
  },
});