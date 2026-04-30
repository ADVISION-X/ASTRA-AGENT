import path from "node:path";

import { Node, SyntaxKind, type Project, type SourceFile, type VariableDeclaration } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";

const { CHILDREN_ROOT, CLOCK_PATH, REGISTRY_PATH, REQUIRED_FILES, ROOT } = commanderConsoleInspectionConstants;

function childDirectoryFiles(childId: string): string[] {
  return [
    `${CHILDREN_ROOT}/${childId}/contract.ts`,
    `${CHILDREN_ROOT}/${childId}/schema.ts`,
    `${CHILDREN_ROOT}/${childId}/implementation.ts`,
  ];
}

function toPascalCase(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function toUpperSnakeCase(value: string): string {
  return value.replace(/-/g, "_").toUpperCase();
}

function hasExportStar(sourceFile: SourceFile): boolean {
  return sourceFile.getExportDeclarations().some((declaration) => declaration.getText().startsWith("export *"));
}

function hasSuppressionComment(sourceFile: SourceFile): boolean {
  const text = sourceFile.getFullText();
  return text.includes("@ts-ignore") || text.includes("@ts-expect-error") || text.includes("eslint-disable");
}

function hasDynamicImportOrRequire(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getKind() === SyntaxKind.ImportKeyword
      || (Node.isIdentifier(expression) && expression.getText() === "require");
  });
}

function hasAsAny(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.AsExpression).some((expression) => expression.getTypeNode()?.getText() === "any");
}

function hasUnknownAs(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes("as unknown as");
}

function hasPassthrough(sourceFile: SourceFile): boolean {
  return sourceFile.getFullText().includes(".passthrough()");
}

function hasDateParse(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((expression) => expression.getText() === "Date.parse");
}

function hasNewDate(sourceFile: SourceFile): boolean {
  return sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) => expression.getExpression().getText() === "Date");
}

function countOccurrences(text: string, fragment: string): number {
  return text.split(fragment).length - 1;
}

function getCommanderSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter((sourceFile) => toRepoRelativePath(sourceFile.getFilePath()).startsWith(`${ROOT}/`));
}

function getExportedDeclarationNames(sourceFile: SourceFile): Set<string> {
  return new Set(sourceFile.getExportedDeclarations().keys());
}

function hasChildSchemaShape(sourceFile: SourceFile, childId: string): boolean {
  const prefix = toPascalCase(childId);
  const exportedNames = getExportedDeclarationNames(sourceFile);
  return sourceFile.getExportDeclarations().length === 0
    && exportedNames.has(`${prefix}InputSchema`)
    && exportedNames.has(`${prefix}OutputSchema`)
    && exportedNames.has(`${prefix}BoundaryPolicySchema`)
    && exportedNames.has(`${prefix}ProofPolicySchema`)
    && exportedNames.has(`${prefix}ReadinessSchema`);
}

function hasChildContractShape(sourceFile: SourceFile, childId: string): boolean {
  const prefix = toPascalCase(childId);
  const upper = toUpperSnakeCase(childId);
  const exportedNames = getExportedDeclarationNames(sourceFile);
  return sourceFile.getExportDeclarations().length === 0
    && exportedNames.has(`${upper}_CHILD_ID`)
    && exportedNames.has(`${upper}_CONTRACT`)
    && exportedNames.has(`${prefix}Input`)
    && exportedNames.has(`${prefix}Output`);
}

function findChildDefinition(sourceFile: SourceFile, childId: string): VariableDeclaration | undefined {
  const namedDefinition = sourceFile.getVariableDeclaration(`${toUpperSnakeCase(childId)}_CHILD`);
  if (namedDefinition) {
    return namedDefinition;
  }

  return sourceFile.getVariableDeclarations().find((declaration) => {
    const initializer = declaration.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
    return Boolean(initializer?.getProperty("inputSchema"))
      && Boolean(initializer?.getProperty("outputSchema"))
      && Boolean(initializer?.getProperty("execute"));
  });
}

function hasChildImplementationShape(sourceFile: SourceFile, childId: string): boolean {
  const definition = findChildDefinition(sourceFile, childId);
  const initializer = definition?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  return Boolean(
    definition
    && initializer
    && initializer.getProperty("inputSchema")
    && initializer.getProperty("outputSchema")
    && initializer.getProperty("execute"),
  );
}

function referenceLeaksOutsideRegistry(definition: VariableDeclaration): string[] {
  const nameNode = definition.getNameNode();
  if (!Node.isIdentifier(nameNode)) {
    return [];
  }

  const references = nameNode.findReferencesAsNodes();
  return [...new Set(references.map((reference) => toRepoRelativePath(reference.getSourceFile().getFilePath())))]
    .filter((filePath) => filePath !== toRepoRelativePath(definition.getSourceFile().getFilePath()))
    .filter((filePath) => filePath !== REGISTRY_PATH);
}

function hasRegistryMetadata(sourceFile: SourceFile): boolean {
  const requiredFragments = [
    "inputSchema",
    "outputSchema",
    "implementation",
    "boundaryPolicy",
    "evidencePolicy",
    "proofPolicy",
    "ownedCommandType",
    "readModelSource",
    "hardStopPriority",
    "idempotencyPolicy",
  ];
  return requiredFragments.every((fragment) => sourceFile.getFullText().includes(fragment));
}

function getRegistryImplementationChildIds(sourceFile: SourceFile): string[] {
  return sourceFile.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue() ?? "")
    .filter((specifier) => specifier.includes("/children/") && specifier.endsWith("/implementation.js"))
    .map((specifier) => path.posix.basename(path.posix.dirname(specifier)));
}

function functionContainsThrow(sourceFile: SourceFile, functionName: string): boolean {
  return (sourceFile.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length ?? 0) > 0;
}

function countCommanderMissionDashboardDeclarations(commanderSources: SourceFile[]): number {
  return commanderSources.reduce((count, sourceFile) => {
    return count + sourceFile.getVariableDeclarations().filter((declaration) => declaration.getName() === "CommanderMissionDashboardViewSchema").length;
  }, 0);
}

function contractCollapsesToAny(declaration: VariableDeclaration | undefined): boolean {
  return declaration ? declaration.getType().isAny() : true;
}

async function requiredFilesExist(): Promise<boolean> {
  const results = await Promise.all(REQUIRED_FILES.map((filePath) => fileExists(pathFromRepoRoot(filePath))));
  return results.every(Boolean);
}

function isCommanderAntiEscapeViolation(sourceFile: SourceFile): boolean {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  return sourceFile.getFullText().includes(": any")
    || hasAsAny(sourceFile)
    || hasUnknownAs(sourceFile)
    || hasSuppressionComment(sourceFile)
    || hasDynamicImportOrRequire(sourceFile)
    || (repoPath !== CLOCK_PATH && hasNewDate(sourceFile))
    || hasDateParse(sourceFile);
}

export const commanderConsoleInspectionUtils = {
  childDirectoryFiles,
  hasExportStar,
  hasPassthrough,
  countOccurrences,
  getCommanderSourceFiles,
  hasChildSchemaShape,
  hasChildContractShape,
  findChildDefinition,
  hasChildImplementationShape,
  referenceLeaksOutsideRegistry,
  hasRegistryMetadata,
  getRegistryImplementationChildIds,
  functionContainsThrow,
  countCommanderMissionDashboardDeclarations,
  contractCollapsesToAny,
  requiredFilesExist,
  isCommanderAntiEscapeViolation,
  toUpperSnakeCase,
} as const;