import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { FORBIDDEN_CAPABILITY_MARKERS, PATHS, PUBLIC_INDEX_ALLOWED_SPECIFIERS } from "./config.js";
import { getRepoPath } from "./project-access.js";

export function isThinAbilityGroup(sourceFile: SourceFile): boolean {
  const fullText = sourceFile.getFullText();
  return hasCallExpressionPath(sourceFile, ["ScreenshotAbilityInputSchema", "parse"])
    && hasCallExpression(sourceFile, "executeScreenshotRequest")
    && hasCallExpression(sourceFile, "createScreenshotRuntimeContext")
    && !fullText.includes("captureBrowserViewport(")
    && !fullText.includes("captureDesktopScreen(")
    && !fullText.includes("captureRegion(")
    && !fullText.includes("optimizeLossless(")
    && !fullText.includes("prepareAiInput(");
}

export function hasForbiddenEscape(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isAsExpression(node)) {
      return false;
    }
    const typeNode = node.getTypeNode();
    return typeNode?.getText() === "any" || node.getText().includes("as unknown as");
  }) || sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword)
    || sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "require")
    || sourceFile.getFullText().includes("@ts-ignore")
    || sourceFile.getFullText().includes("@ts-expect-error")
    || sourceFile.getFullText().includes("eslint-disable");
}

export function hasDateOutsideClock(sourceFile: SourceFile): boolean {
  const repoPath = getRepoPath(sourceFile);
  if (repoPath === `${PATHS.ROOT}/ports/screenshot-clock-port.ts` || repoPath === `${PATHS.ROOT}/runtime/system-screenshot-clock-port.ts`) {
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
  if (repoPath.startsWith(`${PATHS.ROOT}/`) || repoPath.startsWith("scripts/audit/")) {
    return false;
  }
  return sourceFile.getImportDeclarations().some((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    const targetPath = target ? getRepoPath(target) : declaration.getModuleSpecifierValue();
    if (repoPath === "src/lib/local-runtime/workbench.ts" && targetPath === `${PATHS.ROOT}/adapters/index.ts`) {
      return false;
    }
    return targetPath.startsWith(`${PATHS.ROOT}/runtime/`)
      || targetPath.startsWith(`${PATHS.ROOT}/children/`)
      || targetPath.startsWith(`${PATHS.ROOT}/ports/`)
      || targetPath.startsWith(`${PATHS.ROOT}/adapters/`);
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