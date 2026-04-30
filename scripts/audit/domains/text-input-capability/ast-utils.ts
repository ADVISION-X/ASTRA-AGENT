import path from "node:path";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, flattenPropertyAccess } from "../_shared/ast-helpers.js";

export const ROOT = "src/capabilities/text-input";
export const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
export const CONTRACT_PATH = `${ROOT}/contract.ts`;
export const INDEX_PATH = `${ROOT}/index.ts`;
export const REGISTRY_PATH = `${ROOT}/registry.ts`;
export const SCHEMA_PATH = `${ROOT}/schema.ts`;
export const EXECUTOR_PATH = `${ROOT}/runtime/text-input-executor.ts`;
export const INPUT_GATE_PATH = `${ROOT}/runtime/text-input-input-gate.ts`;
export const SOURCE_GATE_PATH = `${ROOT}/runtime/text-source-proof-gate.ts`;
export const APPROVED_TEXT_GATE_PATH = `${ROOT}/runtime/approved-text-gate.ts`;
export const TARGET_GATE_PATH = `${ROOT}/runtime/input-target-proof-gate.ts`;
export const FOCUS_GATE_PATH = `${ROOT}/runtime/focus-proof-gate.ts`;
export const TEXT_POLICY_GATE_PATH = `${ROOT}/runtime/text-policy-gate.ts`;
export const SENSITIVE_GATE_PATH = `${ROOT}/runtime/sensitive-text-gate.ts`;
export const KEY_POLICY_GATE_PATH = `${ROOT}/runtime/key-policy-gate.ts`;
export const COMMIT_POLICY_GATE_PATH = `${ROOT}/runtime/commit-policy-gate.ts`;
export const CLIPBOARD_POLICY_GATE_PATH = `${ROOT}/runtime/clipboard-policy-gate.ts`;
export const RUNNER_PATH = `${ROOT}/runtime/primitive-text-input-runner.ts`;
export const RESULT_BUILDER_PATH = `${ROOT}/runtime/text-input-result-builder.ts`;
export const PROOF_BUILDER_PATH = `${ROOT}/runtime/text-input-proof-builder.ts`;
export const OUTPUT_BOUNDARY_GATE_PATH = `${ROOT}/runtime/text-input-output-boundary-gate.ts`;
export const DEBUG_EVENTS_PATH = `${ROOT}/runtime/text-input-debug-events.ts`;
export const FAILURE_PATH = `${ROOT}/runtime/text-input-dispatch-failure.ts`;
export const CLOCK_PATH = `${ROOT}/runtime/text-input-clock.ts`;
export const CLOCK_PORT_PATH = `${ROOT}/ports/text-input-clock-port.ts`;
export const EXECUTION_PORT_PATH = `${ROOT}/ports/text-input-execution-port.ts`;
export const CLIPBOARD_PORT_PATH = `${ROOT}/ports/clipboard-port.ts`;
export const TYPE_TEXT_IMPL_PATH = `${ROOT}/children/type-text/implementation.ts`;
export const PASTE_TEXT_IMPL_PATH = `${ROOT}/children/paste-text/implementation.ts`;
export const CLEAR_INPUT_IMPL_PATH = `${ROOT}/children/clear-input/implementation.ts`;
export const REPLACE_INPUT_IMPL_PATH = `${ROOT}/children/replace-input/implementation.ts`;
export const PRESS_KEY_IMPL_PATH = `${ROOT}/children/press-key/implementation.ts`;
export const COMMIT_INPUT_IMPL_PATH = `${ROOT}/children/commit-input/implementation.ts`;
export const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
export const PRIMITIVE_ADAPTER_PATH = "src/lib/browser/text-input-primitive-port.ts";
export const CLIPBOARD_ADAPTER_PATH = "src/lib/browser/system-clipboard-port.ts";

export const REQUIRED_FILES = [
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  SOURCE_GATE_PATH,
  APPROVED_TEXT_GATE_PATH,
  TARGET_GATE_PATH,
  FOCUS_GATE_PATH,
  TEXT_POLICY_GATE_PATH,
  SENSITIVE_GATE_PATH,
  KEY_POLICY_GATE_PATH,
  COMMIT_POLICY_GATE_PATH,
  CLIPBOARD_POLICY_GATE_PATH,
  RUNNER_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  OUTPUT_BOUNDARY_GATE_PATH,
  DEBUG_EVENTS_PATH,
  FAILURE_PATH,
  CLOCK_PATH,
  CLOCK_PORT_PATH,
  EXECUTION_PORT_PATH,
  CLIPBOARD_PORT_PATH,
  `${ROOT}/shared/text-input-types.ts`,
  `${ROOT}/shared/text-input-policy.ts`,
  `${ROOT}/shared/text-input-result.ts`,
  `${ROOT}/shared/text-input-proof.ts`,
  `${ROOT}/shared/text-input-failure.ts`,
  `${ROOT}/shared/text-input-source.ts`,
  `${ROOT}/shared/text-input-target.ts`,
  `${ROOT}/shared/text-input-redaction.ts`,
  `${ROOT}/children/type-text/schema.ts`,
  TYPE_TEXT_IMPL_PATH,
  `${ROOT}/children/paste-text/schema.ts`,
  PASTE_TEXT_IMPL_PATH,
  `${ROOT}/children/clear-input/schema.ts`,
  CLEAR_INPUT_IMPL_PATH,
  `${ROOT}/children/replace-input/schema.ts`,
  REPLACE_INPUT_IMPL_PATH,
  `${ROOT}/children/press-key/schema.ts`,
  PRESS_KEY_IMPL_PATH,
  `${ROOT}/children/commit-input/schema.ts`,
  COMMIT_INPUT_IMPL_PATH,
  PRIMITIVE_ADAPTER_PATH,
  CLIPBOARD_ADAPTER_PATH,
] as const;

export const FORBIDDEN_IMPORT_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/screenshot/",
  "src/capabilities/page-state/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/forensics-persistence/",
  "src/capabilities/open/",
  "src/capabilities/mouse-click/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/post-action-verification/",
  "src/lib/browser/",
] as const;

export const FORBIDDEN_TEXT_TOKENS = [
  "as any",
  "as unknown as",
  "@ts-ignore",
  "@ts-expect-error",
  "eslint-disable",
  "keyboard.type",
  "page.keyboard",
  "navigator.clipboard",
  "querySelector(",
  "document.",
  "window.",
] as const;

export function makeProject(): Project {
  return createAuditProject();
}

export function getSourceFile(project: Project, repoRelativePath: string): SourceFile | null {
  return project.getSourceFile(pathFromRepoRoot(repoRelativePath)) ?? null;
}

export async function missingRequiredFiles(): Promise<string[]> {
  const missing: string[] = [];
  for (const filePath of REQUIRED_FILES) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      missing.push(filePath);
    }
  }
  return missing;
}

export function resolveRelativeRepoPath(fromRepoRelativePath: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(fromRepoRelativePath), specifier.replaceAll("\\", "/")));
}

export function getDeclarationTargetPath(declaration: ImportDeclaration | ExportDeclaration): string | null {
  const targetSourceFile = declaration.getModuleSpecifierSourceFile();
  if (targetSourceFile) {
    return toRepoRelativePath(targetSourceFile.getFilePath());
  }

  const specifier = declaration.getModuleSpecifierValue();
  if (!specifier) {
    return null;
  }

  return resolveRelativeRepoPath(toRepoRelativePath(declaration.getSourceFile().getFilePath()), specifier);
}

export function sourceHasPrimitiveExecuteCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      const expressionPath = flattenPropertyAccess(node.getExpression()).join(".");
      return expressionPath.endsWith("executionPort.execute");
    }
    if (Node.isElementAccessExpression(node)) {
      const argument = node.getArgumentExpression();
      return argument !== undefined
        && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === "execute";
    }
    return false;
  });
}

export function sourceHasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

export function sourceHasRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

export function sourceHasForbiddenImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    return targetPath !== null && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.startsWith(prefix));
  });
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isNewExpression(node)) {
      return node.getExpression().getText() === "Date";
    }
    return false;
  });
}

export function getTextInputSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function getExternalImportsWithPrefix(project: Project, targetPrefix: string): string[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    const importerPath = toRepoRelativePath(sourceFile.getFilePath());
    if (importerPath.startsWith(`${ROOT}/`)) {
      return [];
    }

    return sourceFile.getImportDeclarations().flatMap((declaration) => {
      const importedPath = getDeclarationTargetPath(declaration);
      return importedPath && importedPath.startsWith(targetPrefix) ? [importerPath] : [];
    });
  });
}