import path from "node:path";

import { Node, SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists, listFilesRecursive, listImmediateDirectories, readJsonFile, writeJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { getAuditProject, toRelativeSourcePath } from "../../core/ts-morph.js";

const CAPABILITIES_ROOT = pathFromRepoRoot("src/capabilities");
const MUSCLE_MEMORY_CATALOG_PATH = pathFromRepoRoot("src/muscle-memory/catalog/muscle-memory-catalog.generated.json");
const INVENTORY_RELATIVE_PATH = "scripts/audit/generated/child-capability-strength-inventory.generated.json";
const INVENTORY_PATH = pathFromRepoRoot(INVENTORY_RELATIVE_PATH);
const SIDE_EFFECT_ABILITY_GROUPS = new Set(["open", "screenshot", "mouse-click", "text-input", "mouse-scroll", "forensics-persistence"]);
const CHILD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const CHILD_ID_PROPERTY_NAMES = new Set(["childCapabilityId", "sourceChildCapabilityId", "targetChildCapabilityId", "commandName"]);

type AtomicCatalogEntry = {
  actionCode: string;
  type: "atomic";
  abilityGroupId: string;
  childCapabilityId: string;
  allowedForAiActionPlan: boolean;
  sensitiveOperation: boolean;
  requiresPostActionVerification: boolean;
};

type CompositeCatalogEntry = {
  actionCode: string;
  type: "composite";
  allowedForAiActionPlan: boolean;
  steps: Array<{ actionCode: string }>;
};

type MuscleMemoryCatalog = {
  entries: Array<AtomicCatalogEntry | CompositeCatalogEntry>;
};

type ChildCapabilityStrengthEntry = {
  abilityGroupId: string;
  childCapabilityId: string;
  declaredInContract: boolean;
  declaredInSchema: boolean;
  registered: boolean;
  hasChildContract: boolean;
  hasChildSchema: boolean;
  hasChildImplementation: boolean;
  hasExecute: boolean;
  returnsGovernedResult: boolean;
  publicExecuteThrows: boolean;
  hasNerveBusDispatchBuilder: boolean;
  hasCapabilityCatalogEntry: boolean;
  hasMuscleMemoryAction: boolean;
  allowedForAiActionPlan: boolean;
  hasForensicsRecordPath: boolean;
  strengthLevel: 0 | 1 | 2 | 3 | 4;
  actionCodes: string[];
  aiActionCodes: string[];
  blockingReasons: string[];
};

type ChildCapabilityStrengthInventory = {
  generatedAt: string;
  entries: ChildCapabilityStrengthEntry[];
};

const childLiteralCache = new WeakMap<SourceFile, Set<string>>();
const importedChildCache = new WeakMap<SourceFile, Map<"contract" | "schema" | "implementation", Set<string>>>();

const isStringLiteralNode = (node: Node | undefined): node is import("ts-morph").StringLiteral | import("ts-morph").NoSubstitutionTemplateLiteral =>
  Boolean(node) && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node));

const readCatalog = async (): Promise<MuscleMemoryCatalog> => readJsonFile<MuscleMemoryCatalog>(MUSCLE_MEMORY_CATALOG_PATH);

const getImportedChildIds = (sourceFile: SourceFile, kind: "contract" | "schema" | "implementation"): Set<string> => {
  const cached = importedChildCache.get(sourceFile);
  if (cached?.has(kind)) {
    return new Set(cached.get(kind));
  }

  const next = cached ?? new Map<"contract" | "schema" | "implementation", Set<string>>();
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
    if (!CHILD_ID_PATTERN.test(value)) {
      continue;
    }
    if (Node.isImportDeclaration(parent) || Node.isExportDeclaration(parent)) {
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

const addChildArrayValues = (initializer: Node | undefined, values: Set<string>) => {
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

const hasExecuteMember = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute")
    || sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "execute");
};

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

const getAtomicEntries = (catalog: MuscleMemoryCatalog): AtomicCatalogEntry[] =>
  catalog.entries.filter((entry): entry is AtomicCatalogEntry => entry.type === "atomic");

const resolveAiReachableChildKeys = (catalog: MuscleMemoryCatalog): Map<string, Set<string>> => {
  const atomicEntries = new Map(getAtomicEntries(catalog).map((entry) => [entry.actionCode, entry]));
  const compositeEntries = new Map(catalog.entries.filter((entry): entry is CompositeCatalogEntry => entry.type === "composite").map((entry) => [entry.actionCode, entry]));
  const resolved = new Map<string, Set<string>>();

  const visit = (actionCode: string, visited: Set<string>): Set<string> => {
    if (resolved.has(actionCode)) {
      return new Set(resolved.get(actionCode));
    }
    if (visited.has(actionCode)) {
      return new Set<string>();
    }
    visited.add(actionCode);
    const atomic = atomicEntries.get(actionCode);
    if (atomic) {
      const key = `${atomic.abilityGroupId}:${atomic.childCapabilityId}`;
      const single = new Set([key]);
      resolved.set(actionCode, single);
      return single;
    }
    const composite = compositeEntries.get(actionCode);
    const next = new Set<string>();
    if (composite) {
      for (const step of composite.steps) {
        for (const key of visit(step.actionCode, visited)) {
          next.add(key);
        }
      }
    }
    resolved.set(actionCode, next);
    return new Set(next);
  };

  for (const entry of catalog.entries) {
    if (entry.allowedForAiActionPlan) {
      visit(entry.actionCode, new Set<string>());
    }
  }
  return resolved;
};

const getAbilityGroupIds = async (): Promise<string[]> => {
  const directories = await listImmediateDirectories(CAPABILITIES_ROOT);
  return directories.map((directory) => path.basename(directory)).sort((left, right) => left.localeCompare(right));
};

const getSourceFile = (project: Project, relativePath: string): SourceFile | null =>
  project.getSourceFile(pathFromRepoRoot(relativePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath)) ?? null;

const buildBlockingReasons = (entry: Omit<ChildCapabilityStrengthEntry, "strengthLevel" | "blockingReasons">): string[] => {
  const reasons: string[] = [];
  if (!entry.registered && (entry.declaredInSchema || entry.hasChildImplementation || entry.hasMuscleMemoryAction)) reasons.push("CHILD_NOT_REGISTERED");
  if (!entry.declaredInSchema && (entry.registered || entry.hasChildImplementation || entry.hasMuscleMemoryAction)) reasons.push("CHILD_NOT_IN_SCHEMA_UNION");
  if (!entry.hasChildImplementation && (entry.registered || entry.hasMuscleMemoryAction)) reasons.push("CHILD_HAS_NO_IMPLEMENTATION");
  if (entry.hasChildImplementation && !entry.hasExecute) reasons.push("CHILD_HAS_NO_EXECUTE");
  if (entry.hasExecute && !entry.returnsGovernedResult) reasons.push("CHILD_RETURNS_FAKE_SUCCESS");
  if (entry.publicExecuteThrows) reasons.push("CHILD_PUBLIC_EXECUTE_THROWS");
  if (entry.allowedForAiActionPlan && (!entry.registered || !entry.hasChildImplementation || !entry.hasExecute)) reasons.push("AI_ACTION_WITHOUT_CHILD_PATH");
  if (entry.allowedForAiActionPlan && !entry.hasNerveBusDispatchBuilder) reasons.push("AI_ACTION_WITHOUT_NERVE_BUS_PATH");
  if (SIDE_EFFECT_ABILITY_GROUPS.has(entry.abilityGroupId) && !entry.hasForensicsRecordPath) reasons.push("SIDE_EFFECT_ACTION_WITHOUT_FORENSICS");
  return [...new Set(reasons)].sort((left, right) => left.localeCompare(right));
};

const resolveStrengthLevel = (entry: Omit<ChildCapabilityStrengthEntry, "strengthLevel" | "blockingReasons">): 0 | 1 | 2 | 3 | 4 => {
  const hasIdentity = entry.declaredInContract || entry.declaredInSchema || entry.registered || entry.hasChildContract || entry.hasChildSchema || entry.hasChildImplementation;
  if (!hasIdentity) return 0;
  if (!entry.hasChildImplementation || !entry.hasExecute || !entry.returnsGovernedResult || entry.publicExecuteThrows) return 1;
  if (!entry.hasNerveBusDispatchBuilder) return 2;
  if (!entry.hasMuscleMemoryAction || !entry.allowedForAiActionPlan || !entry.hasForensicsRecordPath) return 3;
  return 4;
};

export async function buildChildCapabilityStrengthInventory(project: Project = getAuditProject()): Promise<ChildCapabilityStrengthInventory> {
  const catalog = await readCatalog();
  const atomicEntries = getAtomicEntries(catalog);
  const aiReachableChildKeys = resolveAiReachableChildKeys(catalog);
  const actionCodesByChildKey = new Map<string, Set<string>>();
  const aiActionCodesByChildKey = new Map<string, Set<string>>();

  for (const entry of atomicEntries) {
    const key = `${entry.abilityGroupId}:${entry.childCapabilityId}`;
    if (!actionCodesByChildKey.has(key)) actionCodesByChildKey.set(key, new Set<string>());
    actionCodesByChildKey.get(key)!.add(entry.actionCode);
  }
  for (const entry of catalog.entries) {
    if (!entry.allowedForAiActionPlan) continue;
    for (const key of aiReachableChildKeys.get(entry.actionCode) ?? []) {
      if (!aiActionCodesByChildKey.has(key)) aiActionCodesByChildKey.set(key, new Set<string>());
      aiActionCodesByChildKey.get(key)!.add(entry.actionCode);
    }
  }

  const dispatchReferences = new Map<string, Set<string>>();
  const dispatchSourcePaths = [
    ...(await listFilesRecursive(pathFromRepoRoot("src/lib/local-runtime"), { extensions: [".ts"] })),
    ...(await listFilesRecursive(pathFromRepoRoot("src/capabilities/nerve-bus"), { extensions: [".ts"] })),
  ];
  for (const absolutePath of dispatchSourcePaths) {
    const sourceFile = project.addSourceFileAtPathIfExists(absolutePath);
    if (!sourceFile) {
      continue;
    }
    const relativePath = toRelativeSourcePath(sourceFile);
    for (const childId of getChildLiteralValues(sourceFile)) {
      if (!dispatchReferences.has(childId)) dispatchReferences.set(childId, new Set<string>());
      dispatchReferences.get(childId)!.add(relativePath);
    }
    for (const childId of getChildPropertyValues(sourceFile)) {
      if (!dispatchReferences.has(childId)) dispatchReferences.set(childId, new Set<string>());
      dispatchReferences.get(childId)!.add(relativePath);
    }
  }

  const entries: ChildCapabilityStrengthEntry[] = [];
  for (const abilityGroupId of await getAbilityGroupIds()) {
    const abilityRoot = `src/capabilities/${abilityGroupId}`;
    const childRoot = pathFromRepoRoot(`${abilityRoot}/children`);
    const abilityFiles = (await listFilesRecursive(pathFromRepoRoot(abilityRoot), { extensions: [".ts"] }))
      .map((filePath) => path.relative(pathFromRepoRoot("."), filePath).replaceAll(path.sep, "/"))
      .filter((relativePath) => !/\/children\/[^/]+\//.test(relativePath));
    const registryFiles = abilityFiles.filter((relativePath) => {
      const baseName = path.basename(relativePath);
      return baseName.includes("registry") || baseName.includes("children");
    });
    const schemaFiles = abilityFiles.filter((relativePath) => {
      const baseName = path.basename(relativePath);
      return baseName.includes("schema") || baseName.includes("type");
    });
    const implementationIds = await fileExists(childRoot)
      ? new Set((await listImmediateDirectories(childRoot)).map((directory) => path.basename(directory)))
      : new Set<string>();
    const registryIds = new Set<string>();
    for (const relativePath of registryFiles) {
      const sourceFile = getSourceFile(project, relativePath);
      if (!sourceFile) continue;
      for (const childId of getImportedChildIds(sourceFile, "implementation")) registryIds.add(childId);
      for (const childId of getChildPropertyValues(sourceFile)) registryIds.add(childId);
    }
    const schemaIds = new Set<string>();
    for (const relativePath of schemaFiles) {
      const sourceFile = getSourceFile(project, relativePath);
      if (!sourceFile) continue;
      for (const childId of getImportedChildIds(sourceFile, "schema")) schemaIds.add(childId);
      for (const childId of getChildPropertyValues(sourceFile)) schemaIds.add(childId);
      for (const childId of getChildArrayValues(sourceFile)) schemaIds.add(childId);
    }
    const catalogIds = new Set(atomicEntries.filter((entry) => entry.abilityGroupId === abilityGroupId).map((entry) => entry.childCapabilityId));
    const childIds = [...new Set([...implementationIds, ...registryIds, ...schemaIds, ...catalogIds])].sort((left, right) => left.localeCompare(right));

    for (const childCapabilityId of childIds) {
      const key = `${abilityGroupId}:${childCapabilityId}`;
      const implementationPath = `${abilityRoot}/children/${childCapabilityId}/implementation.ts`;
      const implementationSource = getSourceFile(project, implementationPath);
      const hasChildImplementation = implementationSource !== null;
      const hasChildContract = await fileExists(pathFromRepoRoot(`${abilityRoot}/children/${childCapabilityId}/contract.ts`));
      const hasChildSchema = await fileExists(pathFromRepoRoot(`${abilityRoot}/children/${childCapabilityId}/schema.ts`));
      const actionCodes = [...(actionCodesByChildKey.get(key) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));
      const aiActionCodes = [...(aiActionCodesByChildKey.get(key) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));
      const baseEntry = {
        abilityGroupId,
        childCapabilityId,
        declaredInContract: hasChildContract,
        declaredInSchema: schemaIds.has(childCapabilityId),
        registered: registryIds.has(childCapabilityId),
        hasChildContract,
        hasChildSchema,
        hasChildImplementation,
        hasExecute: implementationSource ? hasExecuteMember(implementationSource) : false,
        returnsGovernedResult: implementationSource ? returnsGovernedResult(implementationSource) : false,
        publicExecuteThrows: implementationSource ? implementationSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0 : false,
        hasNerveBusDispatchBuilder: dispatchReferences.has(childCapabilityId),
        hasCapabilityCatalogEntry: registryIds.has(childCapabilityId),
        hasMuscleMemoryAction: actionCodes.length > 0,
        allowedForAiActionPlan: aiActionCodes.length > 0,
        hasForensicsRecordPath: !SIDE_EFFECT_ABILITY_GROUPS.has(abilityGroupId) || dispatchReferences.has(childCapabilityId) || abilityGroupId === "forensics-persistence",
        actionCodes,
        aiActionCodes,
      };
      entries.push({
        ...baseEntry,
        strengthLevel: resolveStrengthLevel(baseEntry),
        blockingReasons: buildBlockingReasons(baseEntry),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    entries: entries.sort((left, right) => `${left.abilityGroupId}:${left.childCapabilityId}`.localeCompare(`${right.abilityGroupId}:${right.childCapabilityId}`)),
  };
}

export async function writeChildCapabilityStrengthInventory(project: Project = getAuditProject()): Promise<ChildCapabilityStrengthInventory> {
  const inventory = await buildChildCapabilityStrengthInventory(project);
  await writeJsonFile(INVENTORY_PATH, inventory);
  return inventory;
}

export { INVENTORY_RELATIVE_PATH };
export type { ChildCapabilityStrengthEntry, ChildCapabilityStrengthInventory };