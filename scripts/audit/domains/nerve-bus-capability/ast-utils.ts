import path from "node:path";

import { Node, SyntaxKind, type ExportDeclaration, type ImportDeclaration, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createAuditProject, flattenPropertyAccess, getZodEnumValues } from "../_shared/ast-helpers.js";

export const ROOT = "src/capabilities/nerve-bus";
export const ABILITY_GROUP_PATH = `${ROOT}/ability-group.ts`;
export const CONTRACT_PATH = `${ROOT}/contract.ts`;
export const INDEX_PATH = `${ROOT}/index.ts`;
export const REGISTRY_PATH = `${ROOT}/registry.ts`;
export const SCHEMA_PATH = `${ROOT}/schema.ts`;
export const EXECUTOR_PATH = `${ROOT}/runtime/nerve-bus-executor.ts`;
export const INPUT_GATE_PATH = `${ROOT}/runtime/envelope-input-gate.ts`;
export const POLICY_GATE_PATH = `${ROOT}/runtime/channel-policy-gate.ts`;
export const INTEGRITY_GATE_PATH = `${ROOT}/runtime/envelope-integrity-gate.ts`;
export const IDEMPOTENCY_GATE_PATH = `${ROOT}/runtime/transport-idempotency-gate.ts`;
export const TIMEOUT_GATE_PATH = `${ROOT}/runtime/transport-timeout-gate.ts`;
export const RUNNER_PATH = `${ROOT}/runtime/transport-runner.ts`;
export const RESULT_BUILDER_PATH = `${ROOT}/runtime/transport-result-builder.ts`;
export const PROOF_BUILDER_PATH = `${ROOT}/runtime/transport-proof-builder.ts`;
export const DISPATCH_FAILURE_PATH = `${ROOT}/runtime/transport-dispatch-failure.ts`;
export const CONTEXT_PATH = `${ROOT}/runtime/transport-context.ts`;
export const CLOCK_PORT_PATH = `${ROOT}/ports/nerve-bus-clock-port.ts`;
export const HANDLER_PORT_PATH = `${ROOT}/ports/nerve-bus-handler-port.ts`;
export const IDEMPOTENCY_PORT_PATH = `${ROOT}/ports/nerve-bus-idempotency-port.ts`;
export const QUEUE_PORT_PATH = `${ROOT}/ports/nerve-bus-queue-port.ts`;
export const TRANSPORT_PORT_PATH = `${ROOT}/ports/nerve-bus-transport-port.ts`;
export const WORKBENCH_PATH = "src/lib/local-runtime/workbench.ts";
export const ORCHESTRATION_PATH = "src/capabilities/orchestration/ability-group.ts";
export const CHANNELS_ROOT = `${ROOT}/channels`;

export const CHANNEL_IDS = [
  "commander-to-orchestration",
  "orchestration-to-commander",
  "orchestration-to-ability",
  "ability-to-orchestration",
  "orchestration-to-ai",
  "ai-to-orchestration",
] as const;

export const REQUIRED_FILES = [
  ABILITY_GROUP_PATH,
  CONTRACT_PATH,
  INDEX_PATH,
  REGISTRY_PATH,
  SCHEMA_PATH,
  EXECUTOR_PATH,
  INPUT_GATE_PATH,
  POLICY_GATE_PATH,
  INTEGRITY_GATE_PATH,
  IDEMPOTENCY_GATE_PATH,
  TIMEOUT_GATE_PATH,
  RUNNER_PATH,
  RESULT_BUILDER_PATH,
  PROOF_BUILDER_PATH,
  DISPATCH_FAILURE_PATH,
  CONTEXT_PATH,
  CLOCK_PORT_PATH,
  HANDLER_PORT_PATH,
  IDEMPOTENCY_PORT_PATH,
  QUEUE_PORT_PATH,
  TRANSPORT_PORT_PATH,
  `${ROOT}/shared/nerve-bus-channel.ts`,
  `${ROOT}/shared/nerve-bus-envelope.ts`,
  `${ROOT}/shared/nerve-bus-failure.ts`,
  `${ROOT}/shared/nerve-bus-policy.ts`,
  `${ROOT}/shared/nerve-bus-proof.ts`,
  `${ROOT}/shared/nerve-bus-result.ts`,
  `${ROOT}/children/commander-to-orchestration/contract.ts`,
  `${ROOT}/children/commander-to-orchestration/schema.ts`,
  `${ROOT}/children/commander-to-orchestration/implementation.ts`,
  `${ROOT}/children/orchestration-to-commander/contract.ts`,
  `${ROOT}/children/orchestration-to-commander/schema.ts`,
  `${ROOT}/children/orchestration-to-commander/implementation.ts`,
  `${ROOT}/children/orchestration-to-ability/contract.ts`,
  `${ROOT}/children/orchestration-to-ability/schema.ts`,
  `${ROOT}/children/orchestration-to-ability/implementation.ts`,
  `${ROOT}/children/ability-to-orchestration/contract.ts`,
  `${ROOT}/children/ability-to-orchestration/schema.ts`,
  `${ROOT}/children/ability-to-orchestration/implementation.ts`,
  `${ROOT}/children/orchestration-to-ai/contract.ts`,
  `${ROOT}/children/orchestration-to-ai/schema.ts`,
  `${ROOT}/children/orchestration-to-ai/implementation.ts`,
  `${ROOT}/children/ai-to-orchestration/contract.ts`,
  `${ROOT}/children/ai-to-orchestration/schema.ts`,
  `${ROOT}/children/ai-to-orchestration/implementation.ts`,
] as const;

export const FORBIDDEN_IMPORT_PREFIXES = [
  "src/capabilities/ai/",
  "src/capabilities/mouse-click/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/screenshot/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/forensics-persistence/",
  "src/capabilities/open/",
  "src/lib/local-ai/",
] as const;

export const FORBIDDEN_TEXT_TOKENS = ["as any", "as unknown as", "@ts-ignore", "@ts-expect-error", "eslint-disable", "null as never"] as const;

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

export function getNerveBusSourceFiles(project: Project): SourceFile[] {
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

export function sourceHasDynamicImport(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => callExpression.getExpression().getKind() === SyntaxKind.ImportKeyword);
}

export function sourceHasRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "require";
  });
}

export function sourceHasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.isNamespaceExport() || declaration.getText().startsWith("export *"));
}

export function sourceHasForbiddenImport(sourceFile: SourceFile): boolean {
  return sourceFile.getImportDeclarations().some((declaration) => {
    const targetPath = getDeclarationTargetPath(declaration);
    return targetPath !== null && FORBIDDEN_IMPORT_PREFIXES.some((prefix) => targetPath.startsWith(prefix));
  });
}

export function sourceHasNewDateOutsideClock(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (Node.isNewExpression(node)) {
      return node.getExpression().getText() === "Date";
    }
    return Node.isPropertyAccessExpression(node) && node.getText() === "Date.parse";
  });
}

export function sourceUsesComputedHandlerAccess(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendants().some((node) => {
    if (!Node.isElementAccessExpression(node)) {
      return false;
    }

    const expressionPath = flattenPropertyAccess(node.getExpression()).join(".");
    if (!expressionPath.endsWith("handlerPort")) {
      return false;
    }

    const argument = node.getArgumentExpression();
    return argument !== undefined
      && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))
      && ["dispatchAbilityCommand", "dispatchHumanCommand", "requestAi"].includes(argument.getLiteralText());
  });
}

export function getSchemaChannelIds(project: Project): string[] {
  const schemaSource = getSourceFile(project, SCHEMA_PATH);
  return schemaSource ? getZodEnumValues(schemaSource, "NerveBusChannelIdSchema") : [];
}