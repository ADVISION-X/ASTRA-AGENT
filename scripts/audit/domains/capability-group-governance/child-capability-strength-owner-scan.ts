import path from "node:path";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive, listImmediateDirectories } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { toRelativeSourcePath } from "../../core/ts-morph.js";

import type { AtomicCatalogEntry, ChildCapabilityStrengthEntry } from "./child-capability-strength-builder.js";
import { buildAbilityGroupEntries } from "./child-capability-strength-entry-builder.js";

const CAPABILITIES_ROOT = pathFromRepoRoot("src/capabilities");
const CHILD_DIRECTORY_SEGMENT = "/children/";
const CHILD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const CHILD_ID_PROPERTY_NAMES = new Set(["childCapabilityId", "sourceChildCapabilityId", "targetChildCapabilityId", "commandName"]);

type ChildImportKind = "contract" | "schema" | "implementation";
type AbilityGroupScanState = {
  abilityGroupId: string;
  abilityRoot: string;
  childIds: string[];
  registryIds: Set<string>;
  schemaIds: Set<string>;
};

const childLiteralCache = new WeakMap<SourceFile, Set<string>>();
const importedChildCache = new WeakMap<SourceFile, Map<ChildImportKind, Set<string>>>();

const isStringLiteralNode = (node: Node | undefined): node is import("ts-morph").StringLiteral | import("ts-morph").NoSubstitutionTemplateLiteral =>
  Boolean(node) && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node));

const getImportedChildIds = (sourceFile: SourceFile, kind: ChildImportKind): Set<string> => {
  const cached = importedChildCache.get(sourceFile);
  if (cached?.has(kind)) {
    return new Set(cached.get(kind));
  }

  const next = cached ?? new Map<ChildImportKind, Set<string>>();
  const values = new Set<string>();
  for (const declaration of sourceFile.getImportDeclarations()) {
    const match = declaration.getModuleSpecifierValue().match(/(?:^|\/)([^/]+)\/(contract|schema|implementation)(?:\.js)?$/);
    if (match?.[1] && CHILD_ID_PATTERN.test(match[1]) && match[2] === kind) {
      values.add(match[1]);
    }
  }
  next.set(kind, values);
  importedChildCache.set(sourceFile, next);
  return new Set(values);
};

const getChildLiteralValues = (sourceFile: SourceFile): Set<string> => {
  const cached = childLiteralCache.get(sourceFile);
  if (cached) {
    return new Set(cached);
  }

  const values = new Set<string>();
  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)) {
    const parent = node.getParent();
    const value = node.getLiteralText();
    if (!CHILD_ID_PATTERN.test(value) || Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent)) {
      continue;
    }
    values.add(value);
  }
  childLiteralCache.set(sourceFile, values);
  return new Set(values);
};

const getChildPropertyValues = (sourceFile: SourceFile): Set<string> => {
  const values = new Set<string>();
  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (!CHILD_ID_PROPERTY_NAMES.has(property.getName())) {
      continue;
    }
    const initializer = property.getInitializer();
    if (isStringLiteralNode(initializer) && CHILD_ID_PATTERN.test(initializer.getLiteralText())) {
      values.add(initializer.getLiteralText());
    }
  }
  return values;
};

const unwrapArrayLiteral = (node: Node | undefined): import("ts-morph").ArrayLiteralExpression | null => {
  if (!node) {
    return null;
  }
  if (Node.isArrayLiteralExpression(node)) {
    return node;
  }
  if (Node.isAsExpression(node) || Node.isSatisfiesExpression(node) || Node.isParenthesizedExpression(node)) {
    return unwrapArrayLiteral(node.getExpression());
  }
  return null;
};

const addChildArrayValues = (initializer: Node | undefined, values: Set<string>): void => {
  const arrayLiteral = unwrapArrayLiteral(initializer);
  if (!arrayLiteral) {
    return;
  }

  for (const element of arrayLiteral.getElements()) {
    if (isStringLiteralNode(element) && CHILD_ID_PATTERN.test(element.getLiteralText())) {
      values.add(element.getLiteralText());
    }
  }
};

const getChildArrayValues = (sourceFile: SourceFile): Set<string> => {
  const values = new Set<string>();
  for (const declaration of sourceFile.getVariableDeclarations()) {
    if (declaration.getName().toUpperCase().includes("CHILD")) {
      addChildArrayValues(declaration.getInitializer(), values);
    }
  }

  for (const declaration of sourceFile.getImportDeclarations()) {
    for (const namedImport of declaration.getNamedImports()) {
      if (!namedImport.getName().toUpperCase().includes("CHILD")) {
        continue;
      }
      const aliasedSymbol = namedImport.getNameNode().getSymbol()?.getAliasedSymbol();
      const variableDeclaration = aliasedSymbol?.getDeclarations().find(Node.isVariableDeclaration);
      addChildArrayValues(variableDeclaration?.getInitializer(), values);
    }
  }
  return values;
};

const hasExecuteMember = (sourceFile: SourceFile): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute")
  || sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "execute");

const returnsGovernedResult = (sourceFile: SourceFile): boolean => {
  const callBased = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expressionText = call.getExpression().getText();
    return expressionText.endsWith("Schema.parse")
      || /^execute[A-Z]/.test(expressionText)
      || /^build[A-Z].*Result/.test(expressionText)
      || expressionText === "executeForensicsChild";
  });
  if (callBased) {
    return true;
  }

  return sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== "status") {
      return false;
    }
    const initializer = property.getInitializer();
    return isStringLiteralNode(initializer) && ["success", "failed", "review_required"].includes(initializer.getLiteralText());
  });
};

const getAbilityGroupIds = async (): Promise<string[]> => {
  const directories = await listImmediateDirectories(CAPABILITIES_ROOT);
  return directories.map((directory) => path.basename(directory)).sort((left, right) => left.localeCompare(right));
};

const getSourceFile = (project: Project, relativePath: string): SourceFile | null =>
  project.getSourceFile(pathFromRepoRoot(relativePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath)) ?? null;

const addReference = (references: Map<string, Set<string>>, childId: string, relativePath: string): void => {
  if (!references.has(childId)) {
    references.set(childId, new Set<string>());
  }
  references.get(childId)?.add(relativePath);
};

const collectDispatchReferencesFromFile = (
  sourceFile: SourceFile,
  references: Map<string, Set<string>>,
): void => {
  const relativePath = toRelativeSourcePath(sourceFile);
  for (const childId of getChildLiteralValues(sourceFile)) {
    addReference(references, childId, relativePath);
  }
  for (const childId of getChildPropertyValues(sourceFile)) {
    addReference(references, childId, relativePath);
  }
};

const collectDispatchReferences = async (project: Project): Promise<Map<string, Set<string>>> => {
  const references = new Map<string, Set<string>>();
  const dispatchSourcePaths = [
    ...(await listFilesRecursive(pathFromRepoRoot("src/lib/local-runtime"), { extensions: [".ts"] })),
    ...(await listFilesRecursive(pathFromRepoRoot("src/capabilities/nerve-bus"), { extensions: [".ts"] })),
  ];

  for (const absolutePath of dispatchSourcePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(absolutePath);
    if (sourceFile) {
      collectDispatchReferencesFromFile(sourceFile, references);
    }
  }
  return references;
};

const collectAbilityFiles = async (abilityRoot: string): Promise<string[]> => {
  const abilityFiles = await listFilesRecursive(pathFromRepoRoot(abilityRoot), { extensions: [".ts"] });
  return abilityFiles
    .map((filePath) => path.relative(pathFromRepoRoot("."), filePath).replaceAll(path.sep, "/"))
    .filter((relativePath) => !relativePath.includes(CHILD_DIRECTORY_SEGMENT));
};

const collectRegistryIds = (project: Project, registryFiles: string[]): Set<string> => {
  const registryIds = new Set<string>();
  for (const relativePath of registryFiles) {
    const sourceFile = getSourceFile(project, relativePath);
    if (!sourceFile) {
      continue;
    }
    for (const childId of getImportedChildIds(sourceFile, "implementation")) registryIds.add(childId);
    for (const childId of getChildPropertyValues(sourceFile)) registryIds.add(childId);
  }
  return registryIds;
};

const collectSchemaIds = (project: Project, schemaFiles: string[]): Set<string> => {
  const schemaIds = new Set<string>();
  for (const relativePath of schemaFiles) {
    const sourceFile = getSourceFile(project, relativePath);
    if (!sourceFile) {
      continue;
    }
    for (const childId of getImportedChildIds(sourceFile, "schema")) schemaIds.add(childId);
    for (const childId of getChildPropertyValues(sourceFile)) schemaIds.add(childId);
    for (const childId of getChildArrayValues(sourceFile)) schemaIds.add(childId);
  }
  return schemaIds;
};

const resolveAbilityGroupFileSets = async (project: Project, abilityRoot: string) => {
  const abilityFiles = await collectAbilityFiles(abilityRoot);
  const registryFiles = abilityFiles.filter((relativePath) => {
    const baseName = path.basename(relativePath);
    return baseName.includes("registry") || baseName.includes("children");
  });
  const schemaFiles = abilityFiles.filter((relativePath) => {
    const baseName = path.basename(relativePath);
    return baseName.includes("schema") || baseName.includes("type");
  });
  return {
    registryIds: collectRegistryIds(project, registryFiles),
    schemaIds: collectSchemaIds(project, schemaFiles),
  };
};
const resolveChildIds = (
  implementationIds: Set<string>,
  registryIds: Set<string>,
  schemaIds: Set<string>,
  catalogIds: Set<string>,
): string[] => [...new Set([...implementationIds, ...registryIds, ...schemaIds, ...catalogIds])].sort((left, right) => left.localeCompare(right));

const resolveImplementationIds = async (childRoot: string): Promise<Set<string>> => {
  if (!(await fileExists(childRoot))) {
    return new Set<string>();
  }
  const directories = await listImmediateDirectories(childRoot);
  return new Set(directories.map((directory) => path.basename(directory)));
};

const buildAbilityGroupState = async (
  project: Project,
  abilityGroupId: string,
  atomicEntries: AtomicCatalogEntry[],
): Promise<AbilityGroupScanState> => {
  const abilityRoot = `src/capabilities/${abilityGroupId}`;
  const childRoot = pathFromRepoRoot(`${abilityRoot}/children`);
  const implementationIds = await resolveImplementationIds(childRoot);
  const { registryIds, schemaIds } = await resolveAbilityGroupFileSets(project, abilityRoot);
  const catalogIds = new Set(atomicEntries.filter((entry) => entry.abilityGroupId === abilityGroupId).map((entry) => entry.childCapabilityId));
  return {
    abilityGroupId,
    abilityRoot,
    childIds: resolveChildIds(implementationIds, registryIds, schemaIds, catalogIds),
    registryIds,
    schemaIds,
  };
};

export const collectChildCapabilityStrengthEntries = async (
  project: Project,
  atomicEntries: AtomicCatalogEntry[],
  actionCodesByChildKey: Map<string, Set<string>>,
  aiActionCodesByChildKey: Map<string, Set<string>>,
): Promise<ChildCapabilityStrengthEntry[]> => {
  const abilityGroupIds = await getAbilityGroupIds();
  const dispatchReferences = await collectDispatchReferences(project);
  const states = await Promise.all(abilityGroupIds.map((abilityGroupId) => buildAbilityGroupState(project, abilityGroupId, atomicEntries)));
  const entryGroups = await Promise.all(
    states.map((state) => buildAbilityGroupEntries({ project, state, dispatchReferences, actionCodesByChildKey, aiActionCodesByChildKey })),
  );
  return entryGroups.flat();
};

export type { AbilityGroupScanState };