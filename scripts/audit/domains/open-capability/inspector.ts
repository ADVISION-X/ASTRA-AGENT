import path from "node:path";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getClassMethod,
  getSourceFileOrThrow,
  getTypeAliasPropertyNames,
  hasInterfaceMethod,
  hasPropertyAccessPath,
  hasStringLiteral,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { inspectLocalBrowserSessionBoundary } from "../local-browser-session/inspector.js";
import { inspectPlatformActionBoundary } from "../platform-action/inspector.js";

const LAW_ID = "GRASSEYE-OPEN-CAPABILITY-001-V1";
const OPEN_ROOT = "src/capabilities/open";
const LEGACY_OPEN_ROOT = "src/lib/local-runtime/open-drawer";
const CONTRACT_PATH = "src/capabilities/open/contract.ts";
const ORCHESTRATOR_PATH = "src/capabilities/open/orchestrate-open.ts";
const PLATFORM_ADAPTER_PATH = "src/lib/local-runtime/platform-runtime-contract.ts";
const TIKTOK_ADAPTER_PATH = "src/lib/local-runtime/tiktok-platform/runtime.ts";
const BOOTSTRAP_PATH = "src/lib/local-runtime/runtime-bootstrap.ts";
const AGENT_SERVICE_PATH = "src/lib/local-runtime/runtime-executor.ts";
const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";

const CHILDREN = [
  "open-tiktok",
  "open-facebook",
  "open-local-workbench",
] as const;

const REQUIRED_RESULT_FIELDS = [
  "drawer",
  "capabilityId",
  "childCapabilityId",
  "targetKind",
  "sessionId",
  "roundId",
  "startedAt",
  "endedAt",
  "durationMs",
  "status",
  "targetUrl",
  "openedUrl",
  "targetTitle",
  "message",
  "failureReason",
  "nextCapability",
  "fallbackUsed",
  "loginState",
  "reviewRequiredReason",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "local-ai",
  "comments",
  "comment",
  "product-signal",
  "screenshot-drawer",
  "vision-coordinate",
  "platform-action/adapters",
];

const FORBIDDEN_FILE_NAME_MARKERS = ["compat", "legacy", "bridge"];

export default createPendingDomainInspector({
  inspector: "GrassEye Open Capability Owner Inspector",
  inspectorId: "open-capability-owner",
  capabilityDomain: "open-capability",
  inspectorEntry: "scripts/audit/domains/open-capability/inspector.ts",
  ownedPaths: [OPEN_ROOT],
  pendingSummary: "open-capability law exists but canonical open root is not fully established yet",
  implementedSummary: "open-capability is implemented as a canonical drawer with child capabilities and direct enforcement",
  extraChecks: async () => {
    const project = createAuditProject();
    const contractSource = getSourceFileOrThrow(project, CONTRACT_PATH);
    const orchestratorSource = getSourceFileOrThrow(project, ORCHESTRATOR_PATH);
    const platformAdapterSource = getSourceFileOrThrow(project, PLATFORM_ADAPTER_PATH);
    const tiktokAdapterSource = getSourceFileOrThrow(project, TIKTOK_ADAPTER_PATH);
    const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);

    const findings: Finding[] = [];
    const repoTsFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts", ".tsx"] });
    const openRootFiles = await listFilesRecursive(pathFromRepoRoot(OPEN_ROOT), { extensions: [".ts"] });
    const legacyRootExists = await fileExists(pathFromRepoRoot(LEGACY_OPEN_ROOT));
    const legacyBootstrapExists = await fileExists(pathFromRepoRoot(BOOTSTRAP_PATH));
    const illegalAgentRuntimeExists = await fileExists(pathFromRepoRoot(AGENT_SERVICE_PATH));

    const inputProps = getTypeAliasPropertyNames(contractSource, "OpenCapabilityInput");
    const resultProps = getTypeAliasPropertyNames(contractSource, "OpenCapabilityResult");
    const contractPassed = [
      inputProps.has("browserController"),
      inputProps.has("reason"),
      inputProps.has("targetUrl"),
      inputProps.has("targetTitle"),
      inputProps.has("roundId"),
      ...REQUIRED_RESULT_FIELDS.map((field) => resultProps.has(field)),
      Boolean(contractSource.getInterface("OpenCapability")),
      Boolean(contractSource.getInterface("OpenDrawer")),
    ].every(Boolean);
    if (!contractPassed) {
      findings.push(createFinding({ lawId: LAW_ID, file: CONTRACT_PATH, line: 1, severity: "error", message: "Open capability contract must expose one unified input, one unified result, and drawer-level interfaces." }));
    }

    const childFilesPresent = await Promise.all(
      CHILDREN.flatMap((child) => [
        fileExists(pathFromRepoRoot(`${OPEN_ROOT}/${child}/capability.ts`)),
        fileExists(pathFromRepoRoot(`${OPEN_ROOT}/${child}/capability-check.ts`)),
      ]),
    );
    const childStructurePassed = childFilesPresent.every(Boolean)
      && CHILDREN.every((child) => hasStringLiteral(orchestratorSource, child));
    if (!childStructurePassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1", file: ORCHESTRATOR_PATH, line: 1, severity: "error", message: "Open capability must keep three child folders with capability.ts, capability-check.ts, and orchestrator registration." }));
    }

    const forbiddenOpenImports = openRootFiles.flatMap((filePath) => {
      const repoRelativePath = toRepoRelativePath(filePath);
      const sourceFile = project.getSourceFile(filePath) ?? project.getSourceFile(pathFromRepoRoot(repoRelativePath));
      if (!sourceFile) {
        return [];
      }

      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const moduleSpecifier = declaration.getModuleSpecifierValue();
        return FORBIDDEN_IMPORT_MARKERS.some((marker) => moduleSpecifier.includes(marker))
          ? [repoRelativePath]
          : [];
      });
    });
    if (forbiddenOpenImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-002-V1", file: forbiddenOpenImports[0]!, line: 1, severity: "fatal", message: "Open capability must not import local-ai, comments, screenshot, product-signal, or platform-adapter action implementations." }));
    }

    const childCrossImports = CHILDREN.flatMap((child) => {
      const sourceFile = getSourceFileOrThrow(project, `${OPEN_ROOT}/${child}/capability.ts`);
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const moduleSpecifier = declaration.getModuleSpecifierValue();
        return CHILDREN.some((otherChild) => otherChild !== child && moduleSpecifier.includes(otherChild))
          ? [`${OPEN_ROOT}/${child}/capability.ts`]
          : [];
      });
    });
    if (childCrossImports.length > 0) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-003-V1", file: childCrossImports[0]!, line: 1, severity: "error", message: "Open child capabilities must not import another child implementation." }));
    }

    const openRootNamingPassed = openRootFiles.every((filePath) => !FORBIDDEN_FILE_NAME_MARKERS.some((marker) => path.basename(filePath).includes(marker)));
    if (!openRootNamingPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: OPEN_ROOT, line: 1, severity: "error", message: "Open capability root must not keep compat, legacy, or bridge file names." }));
    }

    const adapterBoundaryPassed = [
      hasInterfaceMethod(platformAdapterSource, "PlatformAdapter", "prepareOpenedPage"),
      !hasInterfaceMethod(platformAdapterSource, "PlatformAdapter", "openFeed"),
      !hasInterfaceMethod(platformAdapterSource, "PlatformAdapter", "openTargetPage"),
      !hasInterfaceMethod(platformAdapterSource, "PlatformAdapter", "openPlatformPage"),
      Boolean(getClassMethod(tiktokAdapterSource, "TikTokPlatformAdapter", "prepareOpenedPage")),
      !Boolean(getClassMethod(tiktokAdapterSource, "TikTokPlatformAdapter", "openFeed")),
      !tiktokAdapterSource.getFullText().includes("lib/mission-runtime/open-drawer"),
      !tiktokAdapterSource.getFullText().includes("src/capabilities/open"),
    ].every(Boolean);
    if (!adapterBoundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: PLATFORM_ADAPTER_PATH, line: 1, severity: "error", message: "PlatformAdapter must not own openFeed/openTargetPage/openPlatformPage and adapters must not import Open Drawer implementations." }));
    }

    const runtimeBoundaryPassed = !legacyBootstrapExists
      && !illegalAgentRuntimeExists
      && !workbenchSource.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes("lib/mission-runtime/open-drawer"));
    if (!runtimeBoundaryPassed) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: BOOTSTRAP_PATH, line: 1, severity: "error", message: "Agent runtime must consume the Open Drawer contract only and must not keep direct browser open or legacy open-drawer imports." }));
    }

    if (legacyBootstrapExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: BOOTSTRAP_PATH, line: 1, severity: "fatal", message: "Legacy local-runtime bootstrap execution slice must be physically removed after Open capability cutover." }));
    }

    if (illegalAgentRuntimeExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: AGENT_SERVICE_PATH, line: 1, severity: "fatal", message: "Illegal local-runtime executor must be physically removed after Open capability cutover." }));
    }

    const startupEscape = repoTsFiles.find((filePath) => {
      const sourceFile = project.getSourceFile(filePath) ?? project.getSourceFile(pathFromRepoRoot(toRepoRelativePath(filePath)));
      return sourceFile?.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue().includes("open-commander-console")) ?? false;
    }) ?? null;
    if (startupEscape) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: toRepoRelativePath(startupEscape), line: 1, severity: "fatal", message: "Source runtime must not import the startup open-commander-console helper as governed platform open capability." }));
    }

    if (legacyRootExists) {
      findings.push(createFinding({ lawId: "GRASSEYE-OPEN-CAPABILITY-001-V1", file: LEGACY_OPEN_ROOT, line: 1, severity: "fatal", message: "Legacy open-drawer root must be physically removed after migration." }));
    }

    const platformProfile = await inspectPlatformActionBoundary();
    const browserSession = await inspectLocalBrowserSessionBoundary();

    return {
      findings: [...findings, ...platformProfile.findings, ...browserSession.findings],
      phases: [
        createPhase("open-contract", contractPassed ? "PASS" : "CODE VIOLATION", contractPassed, contractPassed ? "Open contract exposes one governed input and one governed result shape." : "Open contract is missing required unified input or result fields."),
        createPhase("open-child-structure", childStructurePassed ? "PASS" : "CODE VIOLATION", childStructurePassed, childStructurePassed ? "Canonical open root contains three child capabilities and orchestrator registration." : "Open child structure or orchestrator registration is incomplete."),
        createPhase("open-boundary-purity", forbiddenOpenImports.length === 0 && childCrossImports.length === 0 && openRootNamingPassed ? "PASS" : "CODE VIOLATION", forbiddenOpenImports.length === 0 && childCrossImports.length === 0 && openRootNamingPassed, forbiddenOpenImports.length === 0 && childCrossImports.length === 0 && openRootNamingPassed ? "Open root stays pure and free of compat, AI, comment, screenshot, and child-cross-import drift." : "Open root still carries forbidden capability coupling or compat drift."),
        createPhase("open-owner-cutover", adapterBoundaryPassed && runtimeBoundaryPassed && !startupEscape && !legacyRootExists ? "PASS" : "CODE VIOLATION", adapterBoundaryPassed && runtimeBoundaryPassed && !startupEscape && !legacyRootExists, adapterBoundaryPassed && runtimeBoundaryPassed && !startupEscape && !legacyRootExists ? "Open owner cutover is complete: adapters lost open ownership, runtime consumes the drawer contract, and legacy root is gone." : "Open owner cutover is incomplete or legacy escape paths remain."),
        ...platformProfile.phases,
        ...browserSession.phases,
      ],
    };
  },
});