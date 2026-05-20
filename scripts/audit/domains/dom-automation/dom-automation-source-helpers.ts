import { existsSync, readFileSync } from "node:fs";
import type { SourceFile } from "ts-morph";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { resolveImportedDeclarationPaths, resolveModuleTargetPath } from "./components/dom-automation-module-resolution.js";
import type { DomAutomationBinaryCheckContext } from "./dom-automation-binary-types.js";
import { DOM_FACADE_PATH, CURRENT_CHROME_PATH } from "./dom-automation-path-constants.js";
import { sourceFile } from "./dom-automation-shape-helpers.js";

export const sourceText = (context: DomAutomationBinaryCheckContext, repoPath: string): string =>
  sourceFile(context, repoPath)?.getFullText() ?? (existsSync(pathFromRepoRoot(repoPath)) ? readFileSync(pathFromRepoRoot(repoPath), "utf8") : "");

export const sourceFilesWithin = (context: DomAutomationBinaryCheckContext, repoPath: string): SourceFile[] =>
  context.auditProject.project.getSourceFiles().filter((file) => toRepoRelativePath(file.getFilePath()).startsWith(`${repoPath}/`));

export const repoPathOf = (file: SourceFile): string => toRepoRelativePath(file.getFilePath());

export const findForbiddenImports = (context: DomAutomationBinaryCheckContext, ownerRoot: string, forbiddenRoots: readonly string[]): string[] => {
  const violations: string[] = [];
  for (const file of sourceFilesWithin(context, ownerRoot)) {
    for (const importDeclaration of file.getImportDeclarations()) {
      const moduleTargetPath = resolveModuleTargetPath(importDeclaration);
      if (ownerRoot === "src/plugins/amazon-invoice-upload" && moduleTargetPath === DOM_FACADE_PATH) {
        continue;
      }
      const targets = resolveImportedDeclarationPaths(importDeclaration);
      const matched = targets.find((target) => forbiddenRoots.some((root) => target === root || target.startsWith(`${root}/`)));
      if (matched) {
        violations.push(`${repoPathOf(file)}:${importDeclaration.getStartLineNumber()} -> ${matched}`);
      }
    }
  }
  return violations;
};

export const hasVisualMissionDomImport = (context: DomAutomationBinaryCheckContext): boolean =>
  sourceFilesWithin(context, "src/visual-mission").some((file) => file.getImportDeclarations().some((importDeclaration) => {
    const targets = resolveImportedDeclarationPaths(importDeclaration);
    return targets.some((target) => target.startsWith("src/capabilities/dom-automation/"));
  }));

export const hasSecondBrowserController = (context: DomAutomationBinaryCheckContext): string[] =>
  context.auditProject.project.getSourceFiles("src/**/*.ts")
    .flatMap((file) => file.getClasses()
      .filter((klass) => klass.getName() !== "CurrentChromeBrowserController")
      .filter((klass) => klass.getImplements().some((heritage) => heritage.getText().includes("BrowserController")))
      .map((klass) => `${repoPathOf(file)}:${klass.getStartLineNumber()}`))
    .filter((location) => !location.startsWith(CURRENT_CHROME_PATH));
