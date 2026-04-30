import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

export const ROOT = "src/capabilities/screenshot";
export const AUDIT_ROOT = "scripts/audit/domains/screenshot-capability";
export const CHILDREN = [
  "capture-browser-viewport",
  "capture-desktop-screen",
  "capture-region",
  "optimize-lossless",
  "prepare-ai-input",
] as const;

export const CANONICAL_FILES = [
  `${ROOT}/ability-group.ts`,
  `${ROOT}/contract.ts`,
  `${ROOT}/schema.ts`,
  `${ROOT}/registry.ts`,
  `${ROOT}/index.ts`,
  `${ROOT}/adapters/index.ts`,
  `${ROOT}/runtime/screenshot-executor.ts`,
  `${ROOT}/runtime/screenshot-runtime-context.ts`,
  `${ROOT}/runtime/screenshot-child-contract.ts`,
  `${ROOT}/runtime/screenshot-input-gate.ts`,
  `${ROOT}/runtime/screenshot-payload-budget-gate.ts`,
  `${ROOT}/runtime/screenshot-source-gate.ts`,
  `${ROOT}/runtime/browser-session-gate.ts`,
  `${ROOT}/runtime/page-state-handoff-gate.ts`,
  `${ROOT}/runtime/privacy-policy-gate.ts`,
  `${ROOT}/runtime/region-proof-gate.ts`,
  `${ROOT}/runtime/capture-runner.ts`,
  `${ROOT}/runtime/image-processing-runner.ts`,
  `${ROOT}/runtime/artifact-storage-gate.ts`,
  `${ROOT}/runtime/screenshot-output-boundary-gate.ts`,
  `${ROOT}/runtime/screenshot-result-builder.ts`,
  `${ROOT}/runtime/screenshot-proof-builder.ts`,
  `${ROOT}/runtime/screenshot-dispatch-failure.ts`,
  `${ROOT}/runtime/screenshot-idempotency.ts`,
  `${ROOT}/runtime/screenshot-clock.ts`,
  `${ROOT}/ports/screenshot-capture-port.ts`,
  `${ROOT}/ports/screenshot-artifact-port.ts`,
  `${ROOT}/ports/screenshot-clock-port.ts`,
  `${ROOT}/ports/screenshot-image-processing-port.ts`,
  `${ROOT}/shared/screenshot-types.ts`,
  `${ROOT}/shared/screenshot-policy.ts`,
  `${ROOT}/shared/screenshot-result.ts`,
  `${ROOT}/shared/screenshot-proof.ts`,
  `${ROOT}/shared/screenshot-failure.ts`,
  `${ROOT}/shared/screenshot-artifact.ts`,
  `${ROOT}/shared/screenshot-scale-mapping.ts`,
] as const;

const PUBLIC_INDEX_ALLOWED_SPECIFIERS = [
  "./ability-group.js",
  "./contract.js",
  "./schema.js",
  "./registry.js",
] as const;

const FORBIDDEN_CAPABILITY_MARKERS = [
  "/capabilities/ai/",
  "/capabilities/mouse-click/",
  "/capabilities/mouse-scroll/",
  "/capabilities/geometry-guard/",
  "/capabilities/forensics-persistence/",
  "/capabilities/open/children/",
  "/capabilities/open/runtime/",
] as const;

export function createScreenshotAuditProject(): Project {
  return createAuditProject();
}

export function getSource(project: Project, repoRelativePath: string): SourceFile {
  return getSourceFileOrThrow(project, repoRelativePath);
}

export function getRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

export async function missingCanonicalFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const filePath of CANONICAL_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missing.push(filePath);
    }
  }

  for (const childId of CHILDREN) {
    for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"]) {
      const filePath = `${ROOT}/children/${childId}/${suffix}`;
      if (!(await fileExists(pathFromRepoRoot(filePath)))) {
        missing.push(filePath);
      }
    }
  }

  return missing;
}

export function getScreenshotSources(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => getRepoPath(sourceFile).startsWith(`${ROOT}/`));
}

export function getRegistryChildIds(registrySource: SourceFile): string[] {
  return registrySource
    .getVariableDeclarationOrThrow("REGISTRY_ENTRIES")
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText())
    .filter((value, index, values) => CHILDREN.includes(value as typeof CHILDREN[number]) && values.indexOf(value) === index);
}

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  return hasCallExpressionPath(sourceFile, ["ScreenshotAbilityInputSchema", "parse"])
    && hasCallExpression(sourceFile, "executeScreenshotRequest")
    && hasCallExpression(sourceFile, "createScreenshotRuntimeContext")
    && !sourceFile.getFullText().includes("captureBrowserViewport(")
    && !sourceFile.getFullText().includes("captureDesktopScreen(")
    && !sourceFile.getFullText().includes("captureRegion(")
    && !sourceFile.getFullText().includes("optimizeLossless(")
    && !sourceFile.getFullText().includes("prepareAiInput(");
}

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isAsExpression(node)) {
      return false;
    }

    const typeNode = node.getTypeNode();
    return typeNode?.getText() === "any" || node.getText().includes("as unknown as");
  })
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword)
    || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "require")
    || sourceFile.getFullText().includes("@ts-ignore")
    || sourceFile.getFullText().includes("@ts-expect-error")
    || sourceFile.getFullText().includes("eslint-disable");
}

export function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  if (getRepoPath(sourceFile) === `${ROOT}/ports/screenshot-clock-port.ts`) {
    return false;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date")
    || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((expression) => {
      const callee = expression.getExpression();
      return Node.isPropertyAccessExpression(callee)
        && callee.getExpression().getText() === "Date"
        && (callee.getName() === "now" || callee.getName() === "parse");
    });
}

export function leaksPrivateScreenshotPath(sourceFile: SourceFile): boolean {
  const repoPath = getRepoPath(sourceFile);
  if (repoPath.startsWith(`${ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }

  return sourceFile.getImportDeclarations().some((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    const targetPath = target ? getRepoPath(target) : declaration.getModuleSpecifierValue();
    if (repoPath === "src/lib/local-runtime/workbench.ts" && targetPath === `${ROOT}/adapters/index.ts`) {
      return false;
    }

    return targetPath.startsWith(`${ROOT}/runtime/`)
      || targetPath.startsWith(`${ROOT}/children/`)
      || targetPath.startsWith(`${ROOT}/ports/`)
      || targetPath.startsWith(`${ROOT}/adapters/`);
  });
}

export function usesForbiddenCapabilityImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return FORBIDDEN_CAPABILITY_MARKERS.some((marker) => specifier.includes(marker));
  });
}

export function hasPublicIndexLeak(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => {
    if (declaration.isNamespaceExport()) {
      return true;
    }

    const specifier = declaration.getModuleSpecifierValue() ?? "";
    return specifier.length === 0 || !PUBLIC_INDEX_ALLOWED_SPECIFIERS.includes(specifier as typeof PUBLIC_INDEX_ALLOWED_SPECIFIERS[number]);
  });
}

export function contractLeaksInternalTypes(sourceFile: SourceFile): boolean {
  return Boolean(sourceFile.getInterface("ScreenshotRuntimeContext"))
    || Boolean(sourceFile.getTypeAlias("CreateScreenshotAbilityGroupInput"))
    || Boolean(sourceFile.getInterface("ScreenshotChildCapability"))
    || Boolean(sourceFile.getTypeAlias("ScreenshotExecutionPlan"))
    || Boolean(sourceFile.getTypeAlias("ScreenshotRunnerCaptureResult"));
}