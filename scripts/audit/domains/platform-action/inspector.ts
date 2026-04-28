import { fileExists } from "../../core/filesystem.js";
import { createFinding, createPhase } from "../../core/result.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  hasInterfaceMethod,
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

export const inspectPlatformActionBoundary = async (): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
    const findings: Finding[] = [];
    const project = createAuditProject();
    const legacyRootExists = await fileExists(pathFromRepoRoot(ROOT));
    const verifyRootExists = await fileExists(pathFromRepoRoot(VERIFY_ROOT));

    if (legacyRootExists) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: ROOT,
          line: 1,
          severity: "fatal",
          message: "Retired platform-action root still exists and must be physically removed.",
        }),
      );
    }

    if (await fileExists(pathFromRepoRoot(PLATFORM_ADAPTER_PATH))) {
      const platformAdapter = getSourceFileOrThrow(project, PLATFORM_ADAPTER_PATH);
      const forbiddenMethods = FORBIDDEN_PLATFORM_METHODS.filter((methodName) =>
        hasInterfaceMethod(platformAdapter, "PlatformAdapter", methodName),
      );
      if (forbiddenMethods.length > 0) {
        findings.push(
          createFinding({
            lawId: LAW_ID,
            file: PLATFORM_ADAPTER_PATH,
            line: 1,
            severity: "fatal",
            message: `PlatformAdapter still owns forbidden action methods: ${forbiddenMethods.join(", ")}.`,
          }),
        );
      }
    }

    if (await fileExists(pathFromRepoRoot(TIKTOK_ACTIONS_PATH))) {
      const actionSource = getSourceFileOrThrow(project, TIKTOK_ACTIONS_PATH);
      const exportedActions = FORBIDDEN_PLATFORM_METHODS.filter((methodName) => Boolean(actionSource.getFunction(methodName)));
      if (exportedActions.length > 0) {
        findings.push(
          createFinding({
            lawId: LAW_ID,
            file: TIKTOK_ACTIONS_PATH,
            line: 1,
            severity: "fatal",
            message: `Legacy TikTok action module still owns governed action functions: ${exportedActions.join(", ")}.`,
          }),
        );
      }
    }

    if (await fileExists(pathFromRepoRoot(TIKTOK_ADAPTER_PATH))) {
      const adapterSource = getSourceFileOrThrow(project, TIKTOK_ADAPTER_PATH);
      const adapterClass = adapterSource.getClass("TikTokPlatformAdapter");
      const adapterMethods = FORBIDDEN_PLATFORM_METHODS.filter((methodName) => Boolean(adapterClass?.getMethod(methodName)));
      if (adapterMethods.length > 0) {
        findings.push(
          createFinding({
            lawId: LAW_ID,
            file: TIKTOK_ADAPTER_PATH,
            line: 1,
            severity: "fatal",
            message: `TikTokPlatformAdapter still aggregates forbidden action methods: ${adapterMethods.join(", ")}.`,
          }),
        );
      }

      const hiddenImports = adapterSource.getImportDeclarations().filter((declaration) => {
        const specifier = declaration.getModuleSpecifierValue();
        return HIDDEN_ORCHESTRATOR_IMPORT_MARKERS.some((marker) => specifier.includes(marker));
      });
      if (hiddenImports.length > 0) {
        findings.push(
          createFinding({
            lawId: LAW_ID,
            file: TIKTOK_ADAPTER_PATH,
            line: 1,
            severity: "fatal",
            message: "TikTokPlatformAdapter still imports governed action owners as a hidden orchestrator.",
          }),
        );
      }
    }

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
        const specifier = exportDeclaration.getModuleSpecifierValue() ?? "";
        if (isLegacyPlatformSpecifier(specifier)) {
          importViolations.push(relativePath);
        }
      }
    }

    if (importViolations.length > 0) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: importViolations[0]!,
          line: 1,
          severity: "fatal",
          message: "Import or export graph still references the retired platform-action root.",
        }),
      );
    }

    if (verifyRootExists) {
      findings.push(
        createFinding({
          lawId: LAW_ID,
          file: VERIFY_ROOT,
          line: 1,
          severity: "fatal",
          message: "Verify scripts must not act as enforcement truth for platform-action retirement.",
        }),
      );
    }

    return {
      findings,
      phases: [
        createPhase(
          "platform-profile-root-removal",
          !legacyRootExists ? "PASS" : "CODE VIOLATION",
          !legacyRootExists,
          !legacyRootExists
            ? "Retained platform material no longer depends on a surviving platform-action root."
            : "Platform-action root still survives.",
        ),
        createPhase(
          "platform-profile-forbidden-shape",
          !legacyRootExists ? "PASS" : "CODE VIOLATION",
          !legacyRootExists,
          !legacyRootExists
            ? "Platform action ownership methods are absent from the old boundary."
            : "Platform action ownership methods still exist under the old boundary.",
        ),
        createPhase(
          "platform-profile-boundary-attack",
          importViolations.length === 0 ? "PASS" : "CODE VIOLATION",
          importViolations.length === 0,
          importViolations.length === 0
            ? "Action execution no longer routes through the retired platform-action import graph."
            : "Action execution still routes through the retired platform-action import graph.",
        ),
        createPhase(
          "platform-profile-anti-escape",
          !verifyRootExists ? "PASS" : "CODE VIOLATION",
          !verifyRootExists,
          !verifyRootExists
            ? "No verify-script escape hatch is present for platform-action retirement."
            : "Verify-script escape hatch still exists for platform-action retirement.",
        ),
      ],
    };
};
