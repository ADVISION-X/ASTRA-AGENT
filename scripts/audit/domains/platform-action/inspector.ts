import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
} from "../_shared/ast-helpers.js";

const LAW_ID = "GRASSEYE-PLATFORM-ACTION-001-V1";
const ROOT = "src/features/platform-action";
const PLATFORM_ADAPTER_PATH = `${ROOT}/platform-adapter.ts`;
const TIKTOK_ACTIONS_PATH = `${ROOT}/adapters/tiktok-platform-actions.ts`;
const TIKTOK_ADAPTER_PATH = `${ROOT}/adapters/tiktok-platform-adapter.ts`;
const VERIFY_ROOT = "scripts/verify";

const FORBIDDEN_PLATFORM_METHODS = [
  "prepareOpenedPage",
  "observeCurrentVideo",
  "captureVideoRegion",
  "clickNotInterested",
  "likeOrSaveCandidate",
  "openComments",
  "captureCommentRegion",
  "continueNext",
] as const;

const HIDDEN_ORCHESTRATOR_IMPORT_MARKERS = [
  "capabilities/open",
  "capabilities/screenshot",
  "capabilities/visual-target",
  "capabilities/geometry-guard",
  "capabilities/mouse-click",
  "capabilities/mouse-scroll",
  "capabilities/page-state",
  "capabilities/post-action-verification",
  "lib/browser/browser-controller",
] as const;

const isLegacyPlatformSpecifier = (specifier: string): boolean =>
  specifier.includes("features/platform-action") || specifier.includes("/platform-action/");

const createFatalFinding = (file: string, message: string): Finding => createFinding({
  lawId: LAW_ID,
  file,
  line: 1,
  severity: "fatal",
  message,
});

async function collectRootRemovalFindings(): Promise<{ findings: Finding[]; legacyRootExists: boolean; verifyRootExists: boolean }> {
  const legacyRootExists = await fileExists(pathFromRepoRoot(ROOT));
  const verifyRootExists = await fileExists(pathFromRepoRoot(VERIFY_ROOT));
  const findings: Finding[] = [];
  if (legacyRootExists) {
    findings.push(createFatalFinding(ROOT, "Retired platform-action root still exists and must be physically removed."));
  }
  if (verifyRootExists) {
    findings.push(createFatalFinding(VERIFY_ROOT, "Verify scripts must not act as enforcement truth for platform-action retirement."));
  }
  return { findings, legacyRootExists, verifyRootExists };
}

async function collectLegacyAdapterFindings(project: ReturnType<typeof createAuditProject>): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (await fileExists(pathFromRepoRoot(PLATFORM_ADAPTER_PATH))) {
    const platformAdapter = getSourceFileOrThrow(project, PLATFORM_ADAPTER_PATH);
    const forbiddenMethods = FORBIDDEN_PLATFORM_METHODS.filter((methodName) => hasInterfaceMethod(platformAdapter, "PlatformAdapter", methodName));
    if (forbiddenMethods.length > 0) {
      findings.push(createFatalFinding(PLATFORM_ADAPTER_PATH, `PlatformAdapter still owns forbidden action methods: ${forbiddenMethods.join(", ")}.`));
    }
  }
  if (await fileExists(pathFromRepoRoot(TIKTOK_ACTIONS_PATH))) {
    const actionSource = getSourceFileOrThrow(project, TIKTOK_ACTIONS_PATH);
    const exportedActions = FORBIDDEN_PLATFORM_METHODS.filter((methodName) => Boolean(actionSource.getFunction(methodName)));
    if (exportedActions.length > 0) {
      findings.push(createFatalFinding(TIKTOK_ACTIONS_PATH, `Legacy TikTok action module still owns governed action functions: ${exportedActions.join(", ")}.`));
    }
  }
  return findings;
}

async function collectTikTokAdapterFindings(project: ReturnType<typeof createAuditProject>): Promise<Finding[]> {
  if (!(await fileExists(pathFromRepoRoot(TIKTOK_ADAPTER_PATH)))) {
    return [];
  }
  const findings: Finding[] = [];
  const adapterSource = getSourceFileOrThrow(project, TIKTOK_ADAPTER_PATH);
  const adapterClass = adapterSource.getClass("TikTokPlatformAdapter");
  const adapterMethods = FORBIDDEN_PLATFORM_METHODS.filter((methodName) => Boolean(adapterClass?.getMethod(methodName)));
  if (adapterMethods.length > 0) {
    findings.push(createFatalFinding(TIKTOK_ADAPTER_PATH, `TikTokPlatformAdapter still aggregates forbidden action methods: ${adapterMethods.join(", ")}.`));
  }
  const hiddenImports = adapterSource.getImportDeclarations().filter((declaration) => HIDDEN_ORCHESTRATOR_IMPORT_MARKERS.some((marker) => declaration.getModuleSpecifierValue().includes(marker)));
  if (hiddenImports.length > 0) {
    findings.push(createFatalFinding(TIKTOK_ADAPTER_PATH, "TikTokPlatformAdapter still imports governed action owners as a hidden orchestrator."));
  }
  return findings;
}

function collectImportViolations(project: ReturnType<typeof createAuditProject>): string[] {
  const importViolations: string[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    if (!relativePath.startsWith("src/")) {
      continue;
    }
    for (const importDeclaration of sourceFile.getImportDeclarations()) {
      if (isLegacyPlatformSpecifier(importDeclaration.getModuleSpecifierValue())) {
        importViolations.push(relativePath);
      }
    }
    for (const exportDeclaration of sourceFile.getExportDeclarations()) {
      if (isLegacyPlatformSpecifier(exportDeclaration.getModuleSpecifierValue() ?? "")) {
        importViolations.push(relativePath);
      }
    }
  }
  return importViolations;
}

function createRootRemovalPhase(legacyRootExists: boolean): InspectorPhase {
  return createPhase("platform-profile-root-removal", !legacyRootExists ? "PASS" : "CODE VIOLATION", !legacyRootExists, !legacyRootExists ? "Retained platform material no longer depends on a surviving platform-action root." : "Platform-action root still survives.");
}

function createForbiddenShapePhase(legacyRootExists: boolean): InspectorPhase {
  return createPhase("platform-profile-forbidden-shape", !legacyRootExists ? "PASS" : "CODE VIOLATION", !legacyRootExists, !legacyRootExists ? "Platform action ownership methods are absent from the old boundary." : "Platform action ownership methods still exist under the old boundary.");
}

function createBoundaryAttackPhase(importViolations: string[]): InspectorPhase {
  const importGraphClean = importViolations.length === 0;
  return createPhase("platform-profile-boundary-attack", importGraphClean ? "PASS" : "CODE VIOLATION", importGraphClean, importGraphClean ? "Action execution no longer routes through the retired platform-action import graph." : "Action execution still routes through the retired platform-action import graph.");
}

function createAntiEscapePhase(verifyRootExists: boolean): InspectorPhase {
  return createPhase("platform-profile-anti-escape", !verifyRootExists ? "PASS" : "CODE VIOLATION", !verifyRootExists, !verifyRootExists ? "No verify-script escape hatch is present for platform-action retirement." : "Verify-script escape hatch still exists for platform-action retirement.");
}

export const inspectPlatformActionBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const project = createAuditProject();
  const { findings: rootFindings, legacyRootExists, verifyRootExists } = await collectRootRemovalFindings();
  const findings = [
    ...rootFindings,
    ...(await collectLegacyAdapterFindings(project)),
    ...(await collectTikTokAdapterFindings(project)),
  ];
  const importViolations = collectImportViolations(project);
  if (importViolations.length > 0) {
    findings.push(createFatalFinding(importViolations[0]!, "Import or export graph still references the retired platform-action root."));
  }
  return {
    findings,
    phases: [
      createRootRemovalPhase(legacyRootExists),
      createForbiddenShapePhase(legacyRootExists),
      createBoundaryAttackPhase(importViolations),
      createAntiEscapePhase(verifyRootExists),
    ],
  };
};
