import path from "node:path";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, flattenPropertyAccess } from "../_shared/ast-helpers.js";

export const ROOT = "src/capabilities/mouse-scroll";
export const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
export const CONTRACT_PATH = `${ROOT}/contract.ts`;
export const INDEX_PATH = `${ROOT}/index.ts`;
export const REGISTRY_PATH = `${ROOT}/registry.ts`;
export const SCHEMA_PATH = `${ROOT}/schema.ts`;
export const EXECUTOR_PATH = `${ROOT}/runtime/mouse-scroll-executor.ts`;
export const INPUT_GATE_PATH = `${ROOT}/runtime/mouse-scroll-input-gate.ts`;
export const GEOMETRY_GATE_PATH = `${ROOT}/runtime/geometry-scroll-proof-gate.ts`;
export const POLICY_GATE_PATH = `${ROOT}/runtime/scroll-policy-gate.ts`;
export const SAFETY_GATE_PATH = `${ROOT}/runtime/pre-scroll-safety-gate.ts`;
export const DELTA_RESOLVER_PATH = `${ROOT}/runtime/scroll-delta-resolver.ts`;
export const RUNNER_PATH = `${ROOT}/runtime/primitive-scroll-runner.ts`;
export const IDEMPOTENCY_PATH = `${ROOT}/runtime/mouse-scroll-idempotency.ts`;
export const RESULT_BUILDER_PATH = `${ROOT}/runtime/mouse-scroll-result-builder.ts`;
export const PROOF_BUILDER_PATH = `${ROOT}/runtime/mouse-scroll-proof-builder.ts`;
export const FAILURE_PATH = `${ROOT}/runtime/mouse-scroll-dispatch-failure.ts`;
export const CLOCK_PATH = `${ROOT}/runtime/mouse-scroll-clock.ts`;
export const CLOCK_PORT_PATH = `${ROOT}/ports/mouse-scroll-clock-port.ts`;
export const PRIMITIVE_PORT_PATH = `${ROOT}/ports/mouse-scroll-primitive-port.ts`;
export const RUNTIME_CONTEXT_PATH = `${ROOT}/runtime/mouse-scroll-runtime-context.ts`;
export const EXECUTION_CONTEXT_PATH = `${ROOT}/runtime/mouse-scroll-execution-context.ts`;
export const BROWSER_CHILD_IMPL_PATH = `${ROOT}/children/scroll-browser-viewport/implementation.ts`;
export const DESKTOP_CHILD_IMPL_PATH = `${ROOT}/children/scroll-desktop-screen/implementation.ts`;
export const REGION_CHILD_IMPL_PATH = `${ROOT}/children/scroll-region/implementation.ts`;
export const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
export const PRIMITIVE_ADAPTER_PATH = "src/lib/browser/mouse-scroll-primitive-port.ts";

export const REQUIRED_FILES = [
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  GEOMETRY_GATE_PATH,
  POLICY_GATE_PATH,
  SAFETY_GATE_PATH,
  DELTA_RESOLVER_PATH,
  RUNNER_PATH,
  IDEMPOTENCY_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  FAILURE_PATH,
  CLOCK_PATH,
  CLOCK_PORT_PATH,
  PRIMITIVE_PORT_PATH,
  RUNTIME_CONTEXT_PATH,
  EXECUTION_CONTEXT_PATH,
  `${ROOT}/shared/mouse-scroll-types.ts`,
  `${ROOT}/shared/mouse-scroll-policy.ts`,
  `${ROOT}/shared/mouse-scroll-result.ts`,
  `${ROOT}/shared/mouse-scroll-proof.ts`,
  `${ROOT}/shared/mouse-scroll-failure.ts`,
  `${ROOT}/shared/scroll-magnitude.ts`,
  `${ROOT}/children/scroll-browser-viewport/contract.ts`,
  `${ROOT}/children/scroll-browser-viewport/schema.ts`,
  BROWSER_CHILD_IMPL_PATH,
  `${ROOT}/children/scroll-desktop-screen/contract.ts`,
  `${ROOT}/children/scroll-desktop-screen/schema.ts`,
  DESKTOP_CHILD_IMPL_PATH,
  `${ROOT}/children/scroll-region/contract.ts`,
  `${ROOT}/children/scroll-region/schema.ts`,
  REGION_CHILD_IMPL_PATH,
] as const;

export const FORBIDDEN_IMPORT_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/screenshot/",
  "src/capabilities/page-state/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/forensics-persistence/",
  "src/capabilities/open/",
  "src/capabilities/mouse-click/",
] as const;

export const FORBIDDEN_TEXT_TOKENS = ["as any", "as unknown as", "@ts-ignore", "@ts-expect-error", "eslint-disable"] as const;

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

function resolveRelativeRepoPath(fromRepoRelativePath: string, specifier: string): string | null {
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

export function getMouseScrollSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

export function sourceHasPrimitiveScrollCall(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      const expressionPath = flattenPropertyAccess(node.getExpression()).join(".");
      return expressionPath.endsWith("primitivePort.scroll");
    }
    if (Node.isElementAccessExpression(node)) {
      const argument = node.getArgumentExpression();
      return argument !== undefined
        && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
        && argument.getLiteralText() === "scroll";
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
    return Node.isPropertyAccessExpression(node) && node.getText() === "Date.parse";
  });
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