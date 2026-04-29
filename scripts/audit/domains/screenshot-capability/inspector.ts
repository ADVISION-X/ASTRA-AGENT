import path from "node:path";

import { SyntaxKind, Node } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import {
  createAuditProject,
  getSourceFileOrThrow,
  getZodEnumValues,
  hasCallExpression,
  hasCallExpressionPath,
  hasCallExpressionWithStringLiteralArgument,
  hasIdentifier,
  hasImportModuleSpecifier,
} from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

const LAW_ID = "GRASSEYE-SCREENSHOT-CAPABILITY-001-V1";
const SCREENSHOT_ROOT = "src/capabilities/screenshot";
const SCHEMA_PATH = "src/capabilities/screenshot/schema.ts";
const REGISTRY_PATH = "src/capabilities/screenshot/registry.ts";
const ABILITY_GROUP_PATH = "src/capabilities/screenshot/ability-group.ts";
const EXECUTOR_PATH = "src/capabilities/screenshot/runtime/screenshot-executor.ts";
const RESULT_BUILDER_PATH = "src/capabilities/screenshot/runtime/screenshot-result-builder.ts";
const INSPECTOR_PATH = "scripts/audit/domains/screenshot-capability/inspector.ts";

const CHILD_IDS = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

const REQUIRED_RELATIVE_PATHS = [
  "ability-group.ts",
  "contract.ts",
  "schema.ts",
  "registry.ts",
  "index.ts",
  "runtime/screenshot-executor.ts",
  "runtime/screenshot-input-gate.ts",
  "runtime/screenshot-source-gate.ts",
  "runtime/browser-session-gate.ts",
  "runtime/page-state-handoff-gate.ts",
  "runtime/privacy-policy-gate.ts",
  "runtime/capture-runner.ts",
  "runtime/image-processing-runner.ts",
  "runtime/region-proof-gate.ts",
  "runtime/artifact-storage-gate.ts",
  "runtime/screenshot-result-builder.ts",
  "runtime/screenshot-proof-builder.ts",
  "runtime/screenshot-dispatch-failure.ts",
  "runtime/screenshot-idempotency.ts",
  "runtime/screenshot-clock.ts",
  "ports/screenshot-capture-port.ts",
  "ports/screenshot-artifact-port.ts",
  "ports/screenshot-clock-port.ts",
  "ports/screenshot-image-processing-port.ts",
  "shared/screenshot-types.ts",
  "shared/screenshot-policy.ts",
  "shared/screenshot-result.ts",
  "shared/screenshot-proof.ts",
  "shared/screenshot-failure.ts",
  "shared/screenshot-artifact.ts",
  "shared/screenshot-scale-mapping.ts",
] as const;

const FORBIDDEN_IMPORT_MARKERS = [
  "/capabilities/ai/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/geometry-guard/",
  "/capabilities/forensics-persistence/",
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
];

function getRegistryChildIds(registrySource: ReturnType<typeof getSourceFileOrThrow>): string[] {
  return registrySource
    .getVariableDeclarationOrThrow("REGISTRY_ENTRIES")
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText())
    .filter((value, index, values) => CHILD_IDS.includes(value as typeof CHILD_IDS[number]) && values.indexOf(value) === index);
}

function hasExportStar(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport());
}

function hasNewDateOutsideClock(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function hasDateNow(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "Date.now");
}

function hasDynamicImport(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => expression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

function hasAnyCast(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getTypeNode()?.getText() === "any");
}

function hasUnknownAs(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getFullText().includes("as unknown as");
}

function hasSuppressionComment(sourceFile: ReturnType<typeof getSourceFileOrThrow>): boolean {
  return sourceFile.getFullText().includes("@ts-ignore")
    || sourceFile.getFullText().includes("@ts-expect-error")
    || sourceFile.getFullText().includes("eslint-disable");
}

async function pathExists(relativePath: string): Promise<boolean> {
  return fileExists(pathFromRepoRoot(path.posix.join(SCREENSHOT_ROOT, relativePath)));
}

async function collectScreenshotFiles() {
  return listFilesRecursive(pathFromRepoRoot(SCREENSHOT_ROOT), { extensions: [".ts"] });
}

export default createPendingDomainInspector({
  inspector: "GrassEye Screenshot Capability Owner Inspector",
  inspectorId: "screenshot-capability-owner",
  capabilityDomain: "screenshot-capability",
  inspectorEntry: INSPECTOR_PATH,
  ownedPaths: [SCREENSHOT_ROOT],
  pendingSummary: "screenshot-capability root is missing its governed runtime package",
  implementedSummary: "screenshot-capability is implemented as a governed runtime package with schema, ports, gates, and child execution plans",
  extraChecks: async () => {
    const project = createAuditProject();
    const schemaSource = getSourceFileOrThrow(project, SCHEMA_PATH);
    const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
    const abilityGroupSource = getSourceFileOrThrow(project, ABILITY_GROUP_PATH);
    const executorSource = getSourceFileOrThrow(project, EXECUTOR_PATH);
    const resultBuilderSource = getSourceFileOrThrow(project, RESULT_BUILDER_PATH);
    const screenshotFiles = await collectScreenshotFiles();
    const findings: Finding[] = [];

    const requiredShapeChecks = await Promise.all(REQUIRED_RELATIVE_PATHS.map((relativePath) => pathExists(relativePath)));
    if (requiredShapeChecks.some((value) => !value)) {
      const missing = REQUIRED_RELATIVE_PATHS.filter((_, index) => !requiredShapeChecks[index]);
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: `Screenshot standard package is incomplete. Missing: ${missing.join(", ")}`,
      }));
    }

    const childShapeChecks = await Promise.all(
      CHILD_IDS.flatMap((childId) => [
        pathExists(`children/${childId}/contract.ts`),
        pathExists(`children/${childId}/schema.ts`),
        pathExists(`children/${childId}/implementation.ts`),
      ]),
    );
    if (childShapeChecks.some((value) => !value)) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "Every screenshot child must expose contract.ts, schema.ts, and implementation.ts.",
      }));
    }

    const schemaChildIds = getZodEnumValues(schemaSource, "ScreenshotChildCapabilityIdSchema");
    const registryChildIds = getRegistryChildIds(registrySource);
    const childIdParityPassed = CHILD_IDS.every((childId) => schemaChildIds.includes(childId) && registryChildIds.includes(childId));
    if (!childIdParityPassed) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: REGISTRY_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot schema child ids and registry child ids must match exactly.",
      }));
    }

    const outputParsePassed = hasCallExpressionPath(resultBuilderSource, ["ScreenshotExecutionOutputSchema", "parse"])
      && hasCallExpressionPath(resultBuilderSource, ["ScreenshotResultSchema", "parse"]);
    if (!outputParsePassed) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: RESULT_BUILDER_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot result builders must parse governed output and public result schemas before returning.",
      }));
    }

    const requiredExecutorCallsPassed = [
      "runScreenshotInputGate",
      "runScreenshotSourceGate",
      "runBrowserSessionGate",
      "runPageStateHandoffGate",
      "runPrivacyPolicyGate",
      "runRegionProofGate",
      "runArtifactStorageGate",
      "buildScreenshotRuntimeProof",
      "buildScreenshotResult",
    ].every((identifier) => hasIdentifier(executorSource, identifier));
    if (!requiredExecutorCallsPassed) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: EXECUTOR_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot executor must route through input/source/session/page-state/privacy/region/artifact gates and governed proof/result builders.",
      }));
    }

    const forbiddenExportStarFiles = screenshotFiles
      .filter((filePath) => hasExportStar(getSourceFileOrThrow(project, toRepoRelativePath(filePath))));
    if (forbiddenExportStarFiles.length > 0) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: toRepoRelativePath(forbiddenExportStarFiles[0]!),
        line: 1,
        severity: "fatal",
        message: "Screenshot root must not use export * barrel exports.",
      }));
    }

    const forbiddenCapabilityCheckFiles = screenshotFiles.filter((filePath) => filePath.endsWith("capability-check.ts"));
    if (forbiddenCapabilityCheckFiles.length > 0) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: toRepoRelativePath(forbiddenCapabilityCheckFiles[0]!),
        line: 1,
        severity: "fatal",
        message: "Screenshot capability-check.ts files must be deleted; owner enforcement must close through the ts-morph inspector.",
      }));
    }

    const forbiddenBoundaryImports = screenshotFiles.flatMap((filePath) => {
      const sourceFile = getSourceFileOrThrow(project, toRepoRelativePath(filePath));
      return sourceFile.getImportDeclarations()
        .map((declaration) => declaration.getModuleSpecifierValue())
        .filter((specifier) => FORBIDDEN_IMPORT_MARKERS.some((marker) => specifier.includes(marker)))
        .map(() => toRepoRelativePath(filePath));
    });
    if (forbiddenBoundaryImports.length > 0) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: forbiddenBoundaryImports[0]!,
        line: 1,
        severity: "fatal",
        message: "Screenshot boundary must not import AI, mouse, geometry, forensics, or open implementation modules.",
      }));
    }

    const browserControllerLeak = hasImportModuleSpecifier(abilityGroupSource, "browser-controller")
      || hasImportModuleSpecifier(getSourceFileOrThrow(project, "src/capabilities/screenshot/contract.ts"), "browser-controller");
    if (browserControllerLeak) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: ABILITY_GROUP_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot public surface must depend on governed ports, not BrowserController inputs.",
      }));
    }

    const childImplementationFiles = screenshotFiles.filter((filePath) => filePath.includes("/children/") && filePath.endsWith("/implementation.ts"));
    const directBrowserScreenshot = childImplementationFiles.some((filePath) => hasCallExpressionPath(getSourceFileOrThrow(project, toRepoRelativePath(filePath)), ["browserController", "screenshotRegion"]));
    if (directBrowserScreenshot) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SCREENSHOT_ROOT,
        line: 1,
        severity: "fatal",
        message: "Screenshot children must not call browserController.screenshotRegion directly.",
      }));
    }

    const directScreenCaptureInChildOrShared = screenshotFiles
      .filter((filePath) => filePath.includes("/children/") || filePath.includes("/shared/"))
      .some((filePath) => hasCallExpressionWithStringLiteralArgument(getSourceFileOrThrow(project, toRepoRelativePath(filePath)), ["execFile"], "screencapture"));
    if (directScreenCaptureInChildOrShared) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SCREENSHOT_ROOT,
        line: 1,
        severity: "fatal",
        message: "Screenshot children/shared files must not call execFile(\"screencapture\") directly.",
      }));
    }

    const rawStorageRefLeak = getSourceFileOrThrow(project, SCHEMA_PATH).getFullText().includes("storageRef")
      && !getSourceFileOrThrow(project, SCHEMA_PATH).getFullText().includes("artifactRef");
    if (rawStorageRefLeak) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot public result must not expose raw storageRef as the sole evidence reference.",
      }));
    }

    const rawBrowserCaptureLeak = schemaSource.getFullText().includes("browserCapture");
    if (rawBrowserCaptureLeak) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: SCHEMA_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot public result must not expose raw BrowserCaptureResult objects.",
      }));
    }

    const escapeFiles = screenshotFiles.filter((filePath) => {
      const sourceFile = getSourceFileOrThrow(project, toRepoRelativePath(filePath));
      const isClockPort = toRepoRelativePath(filePath) === "src/capabilities/screenshot/ports/screenshot-clock-port.ts";
      return hasAnyCast(sourceFile)
        || hasUnknownAs(sourceFile)
        || hasSuppressionComment(sourceFile)
        || hasDynamicImport(sourceFile)
        || hasCallExpression(sourceFile, "require")
        || (!isClockPort && (hasDateNow(sourceFile) || hasNewDateOutsideClock(sourceFile)));
    });
    if (escapeFiles.length > 0) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: toRepoRelativePath(escapeFiles[0]!),
        line: 1,
        severity: "fatal",
        message: "Screenshot root must stay closed to as any, as unknown as, suppressions, dynamic import, require, or scattered time sources outside the clock port.",
      }));
    }

    const childImplementationImports = project.getSourceFiles().flatMap((sourceFile) => {
      return sourceFile.getImportDeclarations().flatMap((declaration) => {
        const target = declaration.getModuleSpecifierSourceFile();
        if (!target || !toRepoRelativePath(target.getFilePath()).startsWith(`${SCREENSHOT_ROOT}/children/`)) {
          return [];
        }

        const specifier = declaration.getModuleSpecifierValue();
        if (!specifier.includes("/children/") || !specifier.includes("/implementation")) {
          return [];
        }
        const repoRelativePath = toRepoRelativePath(sourceFile.getFilePath());
        return repoRelativePath === EXECUTOR_PATH ? [] : [repoRelativePath];
      });
    });
    if (childImplementationImports.length > 0) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: childImplementationImports[0]!,
        line: 1,
        severity: "fatal",
        message: "Screenshot child implementations must only be wired through screenshot-executor; external direct imports are forbidden.",
      }));
    }

    const privacyGateWired = hasImportModuleSpecifier(executorSource, "privacy-policy-gate")
      && hasIdentifier(executorSource, "runPrivacyPolicyGate");
    const pageStateGateWired = hasImportModuleSpecifier(executorSource, "page-state-handoff-gate")
      && hasIdentifier(executorSource, "runPageStateHandoffGate");
    const artifactGateWired = hasImportModuleSpecifier(executorSource, "artifact-storage-gate")
      && hasIdentifier(executorSource, "runArtifactStorageGate");
    const proofBuilderWired = hasImportModuleSpecifier(executorSource, "screenshot-proof-builder")
      && hasIdentifier(executorSource, "buildScreenshotRuntimeProof");
    if (!privacyGateWired || !pageStateGateWired || !artifactGateWired || !proofBuilderWired) {
      findings.push(createFinding({
        lawId: LAW_ID,
        file: EXECUTOR_PATH,
        line: 1,
        severity: "fatal",
        message: "Screenshot executor must keep page-state, privacy, artifact, and proof builder wiring closed over runtime execution.",
      }));
    }

    const requiredShapePassed = requiredShapeChecks.every(Boolean) && childShapeChecks.every(Boolean) && childIdParityPassed && outputParsePassed && requiredExecutorCallsPassed;
    const forbiddenShapePassed = forbiddenExportStarFiles.length === 0 && forbiddenCapabilityCheckFiles.length === 0 && !browserControllerLeak && !directBrowserScreenshot && !directScreenCaptureInChildOrShared && !rawStorageRefLeak && !rawBrowserCaptureLeak;
    const boundaryPassed = forbiddenBoundaryImports.length === 0 && childImplementationImports.length === 0 && privacyGateWired && pageStateGateWired && artifactGateWired && proofBuilderWired;
    const antiEscapePassed = escapeFiles.length === 0;

    const phases = [
      createPhase("required-shape-attack", requiredShapePassed ? "PASS" : "CODE VIOLATION", requiredShapePassed, requiredShapePassed ? "Screenshot required shape is complete across schema, registry, runtime gates, ports, and child contracts." : "Screenshot required shape is incomplete or mismatched."),
      createPhase("forbidden-shape-attack", forbiddenShapePassed ? "PASS" : "CODE VIOLATION", forbiddenShapePassed, forbiddenShapePassed ? "Screenshot forbidden shapes are blocked." : "Screenshot still exposes forbidden barrel exports, raw browser/file primitives, or public leaks."),
      createPhase("boundary-attack", boundaryPassed ? "PASS" : "CODE VIOLATION", boundaryPassed, boundaryPassed ? "Screenshot boundary stays inside its governed executor and ports." : "Screenshot boundary still leaks direct imports or missing gate wiring."),
      createPhase("anti-escape-attack", antiEscapePassed ? "PASS" : "CODE VIOLATION", antiEscapePassed, antiEscapePassed ? "Screenshot anti-escape checks are clean." : "Screenshot anti-escape checks found casts, suppressions, dynamic imports, or scattered time sources."),
    ];

    return { findings, phases };
  },
});
