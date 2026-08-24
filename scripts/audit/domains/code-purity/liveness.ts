import { Node, SyntaxKind, type Node as MorphNode, type SourceFile, type VariableDeclaration } from "ts-morph";

import { repoPath, resolveModuleTarget, type ModuleGraphResult } from "./module-graph.js";
import { purityFinding, type PurityFinding, type PurityInput } from "./types.js";

type DeclarationNode = MorphNode & { getName?: () => string | undefined; getNameNode?: () => MorphNode | undefined };
type DeclarationRecord = { exportedNames: string[]; node: DeclarationNode; path: string; symbol: string };
type ExportUses = Map<string, Set<string>>;

const isTopDeclaration = (node: MorphNode): boolean => Node.isFunctionDeclaration(node)
  || Node.isClassDeclaration(node)
  || Node.isInterfaceDeclaration(node)
  || Node.isTypeAliasDeclaration(node)
  || Node.isEnumDeclaration(node)
  || Node.isVariableDeclaration(node);

const declarationOwner = (node: MorphNode): DeclarationRecord["node"] | undefined => node.getAncestors().find(isTopDeclaration) as DeclarationRecord["node"] | undefined;
const variableExported = (node: VariableDeclaration): boolean => node.getVariableStatement()?.isExported() ?? false;
const exported = (node: DeclarationRecord["node"]): boolean => Node.isVariableDeclaration(node) ? variableExported(node) : "isExported" in node && typeof node.isExported === "function" && node.isExported();
const declarationName = (node: DeclarationRecord["node"]): string => node.getName?.() ?? node.getNameNode?.()?.getText() ?? "anonymous";

const records = (input: PurityInput): DeclarationRecord[] => input.sourceFiles.flatMap((source) => {
  const path = repoPath(input.root, source.getFilePath());
  const exportedMap = source.getExportedDeclarations();
  return source.getStatements().flatMap((statement) => {
    const declarations: DeclarationNode[] = Node.isVariableStatement(statement) ? statement.getDeclarations() : isTopDeclaration(statement) ? [statement as DeclarationNode] : [];
    return declarations.map((node) => ({
      exportedNames: [...exportedMap.entries()].filter(([, values]) => values.some((value) => value === node || value.getAncestors().includes(node))).map(([name]) => name),
      node,
      path,
      symbol: declarationName(node),
    }));
  });
});

const markExportUse = (used: ExportUses, path: string, name: string): boolean => {
  const names = used.get(path) ?? new Set<string>();
  if (names.has(name)) return false;
  names.add(name);
  used.set(path, names);
  return true;
};

const importTarget = (input: PurityInput, source: SourceFile, value: string, resolved?: SourceFile): string | null => resolveModuleTarget(input.root, source, value)
  ?? (resolved ? repoPath(input.root, resolved.getFilePath()) : null);

const markNamespaceUses = (used: ExportUses, target: string, namespace: MorphNode): void => {
  if (!Node.isIdentifier(namespace)) return;
  for (const reference of namespace.findReferencesAsNodes()) {
    const parent = reference.getParent();
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === reference) markExportUse(used, target, parent.getName());
  }
};

const collectDirectExportUses = (input: PurityInput, graph: ModuleGraphResult, used: ExportUses): void => {
  for (const source of input.sourceFiles) {
    if (!graph.reachable.has(repoPath(input.root, source.getFilePath()))) continue;
    for (const declaration of source.getImportDeclarations()) {
      const target = importTarget(input, source, declaration.getModuleSpecifierValue(), declaration.getModuleSpecifierSourceFile());
      if (!target) continue;
      if (declaration.getDefaultImport()) markExportUse(used, target, "default");
      for (const named of declaration.getNamedImports()) markExportUse(used, target, named.getName());
      const namespace = declaration.getNamespaceImport();
      if (namespace) markNamespaceUses(used, target, namespace);
    }
  }
};

const propagateNamedReexports = (used: ExportUses, target: string, barrelUses: Set<string>, declaration: ReturnType<SourceFile["getExportDeclarations"]>[number]): boolean => {
  let changed = false;
  for (const item of declaration.getNamedExports()) {
    const exposed = item.getAliasNode()?.getText() ?? item.getName();
    if (barrelUses.has(exposed)) changed = markExportUse(used, target, item.getName()) || changed;
  }
  return changed;
};

const propagateSourceReexports = (input: PurityInput, source: SourceFile, used: ExportUses): boolean => {
  const barrelUses = used.get(repoPath(input.root, source.getFilePath()));
  if (!barrelUses) return false;
  let changed = false;
  for (const declaration of source.getExportDeclarations()) {
    const value = declaration.getModuleSpecifierValue();
    if (!value) continue;
    const target = importTarget(input, source, value, declaration.getModuleSpecifierSourceFile());
    if (!target) continue;
    const named = declaration.getNamedExports();
    if (named.length > 0) changed = propagateNamedReexports(used, target, barrelUses, declaration) || changed;
    else for (const name of barrelUses) changed = markExportUse(used, target, name) || changed;
  }
  return changed;
};

const exportUseMap = (input: PurityInput, graph: ModuleGraphResult): ExportUses => {
  const used: ExportUses = new Map();
  for (const item of input.manifest.externalEntryExports) markExportUse(used, item.filePath, item.exportName);
  collectDirectExportUses(input, graph, used);
  let changed = true;
  while (changed) changed = input.sourceFiles.reduce((result, source) => propagateSourceReexports(input, source, used) || result, false);
  return used;
};

const referenceTargets = (record: DeclarationRecord, byNode: Map<MorphNode, DeclarationRecord>): DeclarationRecord[] => {
  const targets = new Set<DeclarationRecord>();
  for (const identifier of record.node.getDescendantsOfKind(SyntaxKind.Identifier)) {
    for (const definition of identifier.getDefinitions()) {
      const declaration = definition.getDeclarationNode();
      if (!declaration) continue;
      const owner = isTopDeclaration(declaration) ? declaration as DeclarationNode : declarationOwner(declaration);
      const target = owner ? byNode.get(owner) : undefined;
      if (target && target !== record) targets.add(target);
    }
  }
  return [...targets];
};

const executableRoots = (input: PurityInput, byNode: Map<MorphNode, DeclarationRecord>): Set<DeclarationRecord> => {
  const roots = new Set<DeclarationRecord>();
  for (const source of input.sourceFiles) {
    for (const statement of source.getStatements()) {
      if (Node.isImportDeclaration(statement) || Node.isExportDeclaration(statement) || Node.isVariableStatement(statement) || isTopDeclaration(statement)) continue;
      for (const identifier of statement.getDescendantsOfKind(SyntaxKind.Identifier)) {
        for (const definition of identifier.getDefinitions()) {
          const declaration = definition.getDeclarationNode();
          if (!declaration) continue;
          const owner = isTopDeclaration(declaration) ? declaration as DeclarationNode : declarationOwner(declaration);
          const record = owner ? byNode.get(owner) : undefined;
          if (record) roots.add(record);
        }
      }
    }
  }
  return roots;
};

const bagProperties = (declaration: VariableDeclaration): string[] => declaration.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression).getProperties()
  .flatMap((property) => Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property) || Node.isMethodDeclaration(property) ? [property.getName()] : []);

const bagReferenceUsage = (input: PurityInput, graph: ModuleGraphResult, path: string, name: string, nameNode: MorphNode, properties: string[], lawful: Set<string>): { dynamic: boolean; used: Set<string> } => {
  const used = new Set<string>();
  let dynamic = false;
  if (!Node.isIdentifier(nameNode)) return { dynamic, used };
  for (const reference of nameNode.findReferencesAsNodes()) {
    const consumer = repoPath(input.root, reference.getSourceFile().getFilePath());
    if (!graph.reachable.has(consumer)) continue;
    const parent = reference.getParent();
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === reference) used.add(parent.getName());
    if (!Node.isElementAccessExpression(parent) || parent.getExpression() !== reference) continue;
    const argument = parent.getArgumentExpression();
    if (argument && Node.isStringLiteral(argument)) used.add(argument.getLiteralValue());
    else if (lawful.has(`${path}\u0000${name}\u0000${consumer}`)) properties.forEach((property) => used.add(property));
    else dynamic = true;
  }
  return { dynamic, used };
};

const bagDeclarationFindings = (input: PurityInput, graph: ModuleGraphResult, path: string, declaration: VariableDeclaration, lawful: Set<string>): PurityFinding[] => {
  if (!variableExported(declaration) || !Node.isObjectLiteralExpression(declaration.getInitializer())) return [];
  const name = declaration.getName();
  if (!/(?:commands?|handlers?|registr(?:y|ies)|routes?)/iu.test(name)) return [];
  const properties = bagProperties(declaration);
  const usage = bagReferenceUsage(input, graph, path, name, declaration.getNameNode(), properties, lawful);
  const findings = properties.filter((property) => !usage.used.has(property))
    .map((property) => purityFinding("CODE_PURITY_OBJECT_BAG_UNUSED_PROPERTY", path, declaration.getStartLineNumber(), `${name}.${property}`, property));
  if (usage.dynamic) findings.push(purityFinding("CODE_PURITY_OBJECT_BAG_DYNAMIC_USAGE", path, declaration.getStartLineNumber(), name, name));
  return findings;
};

const objectBagFindings = (input: PurityInput, graph: ModuleGraphResult): PurityFinding[] => {
  const lawful = new Set(input.manifest.lawfulDynamicRegistryConsumers.map((item) => `${item.registryFilePath}\u0000${item.registryExportName}\u0000${item.consumerFilePath}`));
  return input.sourceFiles.flatMap((source) => {
    const path = repoPath(input.root, source.getFilePath());
    return source.getVariableDeclarations().flatMap((declaration) => bagDeclarationFindings(input, graph, path, declaration, lawful));
  });
};

export function inspectDeclarationLiveness(input: PurityInput, graph: ModuleGraphResult): PurityFinding[] {
  const declarations = records(input);
  const byNode = new Map(declarations.map((record) => [record.node as MorphNode, record]));
  const exportUses = exportUseMap(input, graph);
  const live = executableRoots(input, byNode);
  for (const record of declarations) if (record.exportedNames.some((name) => exportUses.get(record.path)?.has(name))) live.add(record);
  const dependencies = new Map(declarations.map((record) => [record, referenceTargets(record, byNode)]));
  const queue = [...live];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const dependency of dependencies.get(current) ?? []) if (!live.has(dependency)) { live.add(dependency); queue.push(dependency); }
  }
  const deadExports = new Set(declarations.filter((record) => exported(record.node) && !live.has(record)));
  const deadExportDependencies = new Set([...deadExports].flatMap((record) => dependencies.get(record) ?? []));
  const findings: PurityFinding[] = [];
  for (const record of declarations) {
    if (live.has(record)) continue;
    const code = deadExports.has(record)
      ? "CODE_PURITY_ZOMBIE_EXPORT"
      : deadExportDependencies.has(record)
        ? "CODE_PURITY_DEAD_EXPORT_HELPER_SUBGRAPH"
        : "CODE_PURITY_DEAD_INTERNAL_DECLARATION_SUBGRAPH";
    findings.push(purityFinding(code, record.path, record.node.getStartLineNumber(), record.symbol, record.symbol));
  }
  findings.push(...objectBagFindings(input, graph));
  return findings;
}
