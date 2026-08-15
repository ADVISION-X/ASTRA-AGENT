import { Node, SyntaxKind, VariableDeclarationKind, type ArrowFunction, type Block, type CallExpression, type Identifier, type Node as MorphNode, type SourceFile, type Statement, type VariableDeclaration } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";
import { inspectTaskPersistenceIsolation } from "./task-persistence-isolation-inspector.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";
import { uniqueNodeHttpServerDeclaration } from "./node-http-server-inspector.js";

type DeliveryCase = {
  deliveryArgumentIndex: number;
  deliveryVariable: string;
  filePath: string;
  functionName: string;
  modulePath: string;
  rootVariable: string;
  serverVariable?: string;
};

const deliveryCases: readonly DeliveryCase[] = [
  { filePath: "scripts/acceptance/media-processing-async-route.acceptance.ts", functionName: "handleMediaProcessingRequest", modulePath: "src/app/workbench-media-processing-routes.ts", deliveryArgumentIndex: 3, rootVariable: "dataDir", deliveryVariable: "deliveryDirectory", serverVariable: "server" },
  { filePath: "scripts/acceptance/media-optimizer-app-ui.acceptance.ts", functionName: "handleMediaProcessingRequest", modulePath: "src/app/workbench-media-processing-routes.ts", deliveryArgumentIndex: 3, rootVariable: "dataDir", deliveryVariable: "deliveryDirectory", serverVariable: "server" },
];

const isConstDeclaration = (declaration: VariableDeclaration): boolean =>
  declaration.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const;

const importSpecifierForCall = (call: CallExpression, importedName: string) => {
  const expression = call.getExpression();
  if (!Node.isIdentifier(expression)) return undefined;
  return expression.getSymbol()?.getDeclarations()
    .find((declaration) => Node.isImportSpecifier(declaration) && declaration.getName() === importedName);
};

const isNodeImportCall = (call: CallExpression, importedName: string, moduleName: string): boolean => {
  const specifier = importSpecifierForCall(call, importedName);
  return Node.isImportSpecifier(specifier)
    && specifier.getImportDeclaration().getModuleSpecifierValue() === moduleName;
};

const isDefaultImportReceiver = (identifier: Identifier, moduleName: string): boolean => {
  return identifier.getSymbol()?.getDeclarations().some((declaration) =>
    Node.isImportClause(declaration)
    && declaration.getDefaultImport()?.getSymbol() === identifier.getSymbol()
    && declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)?.getModuleSpecifierValue() === moduleName) ?? false;
};

const isGlobalIdentifier = (identifier: MorphNode | undefined, name: string): boolean =>
  Node.isIdentifier(identifier)
  && identifier.getSymbol()?.getEscapedName().toString() === name
  && (identifier.getSymbol()?.getDeclarations().every((declaration) =>
    declaration.getSourceFile().isDeclarationFile()) ?? false);

const isPathJoinCall = (call: CallExpression): boolean => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "join") return false;
  const receiver = expression.getExpression();
  return Node.isIdentifier(receiver) && isDefaultImportReceiver(receiver, "node:path");
};

const isSafeTemporaryPrefix = (value: string): boolean =>
  value.startsWith("grasseye-")
  && value.endsWith("-")
  && [...value].every((character) =>
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_".includes(character));

const identifierResolvesTo = (node: Node | undefined, declaration: Node): boolean =>
  Node.isIdentifier(node)
  && (node.getSymbol()?.getDeclarations().includes(declaration) ?? false);

const temporaryRootDeclaration = (source: SourceFile, rootVariable: string): VariableDeclaration | null => {
  const declarations = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((candidate) => candidate.getName() === rootVariable);
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  const initializer = declaration?.getInitializer();
  const awaited = initializer && Node.isAwaitExpression(initializer) ? initializer.getExpression() : undefined;
  if (!declaration || !isConstDeclaration(declaration)
    || !Node.isCallExpression(awaited) || !isNodeImportCall(awaited, "mkdtemp", "node:fs/promises")) return null;
  const prefix = awaited.getArguments()[0];
  if (!Node.isCallExpression(prefix) || !isPathJoinCall(prefix) || prefix.getArguments().length !== 2) return null;
  const [temporaryDirectory, safePrefix] = prefix.getArguments();
  return Node.isCallExpression(temporaryDirectory)
    && isNodeImportCall(temporaryDirectory, "tmpdir", "node:os")
    && Node.isStringLiteral(safePrefix)
    && isSafeTemporaryPrefix(safePrefix.getLiteralText())
    ? declaration
    : null;
};

const deliveryDirectoryDeclaration = (
  source: SourceFile,
  input: DeliveryCase,
  root: VariableDeclaration,
): VariableDeclaration | null => {
  const declarations = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((candidate) => candidate.getName() === input.deliveryVariable);
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  const initializer = declaration?.getInitializer();
  if (!declaration || !isConstDeclaration(declaration)
    || !Node.isCallExpression(initializer) || !isPathJoinCall(initializer)
    || initializer.getArguments().length !== 2) return null;
  const [rootArgument, suffix] = initializer.getArguments();
  return identifierResolvesTo(rootArgument, root)
    && Node.isStringLiteral(suffix)
    && suffix.getLiteralText() === "acceptance-downloads"
    ? declaration
    : null;
};

const immediateCleanupBoundary = (root: VariableDeclaration) => {
  const statement = root.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  return statement?.getNextSiblingIfKind(SyntaxKind.TryStatement) ?? null;
};

const isExactCleanupOptions = (object: Node): boolean => {
  if (!Node.isObjectLiteralExpression(object)) return false;
  const properties = object.getProperties();
  if (properties.length !== 2 || !properties.every(Node.isPropertyAssignment)) return false;
  const names = new Set(properties.map((property) => property.getName()));
  return names.size === 2
    && names.has("recursive")
    && names.has("force")
    && properties.every((property) => property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword);
};

const isGuaranteedRootRemoval = (statement: Statement, root: VariableDeclaration): boolean => {
  if (Node.isExpressionStatement(statement)) {
    const awaited = statement.getExpression();
    if (!Node.isAwaitExpression(awaited)) return false;
    const awaitedExpression = awaited.getExpression();
    if (!Node.isCallExpression(awaitedExpression)) return false;
    const call = awaitedExpression;
    const [target, options] = call.getArguments();
    return isNodeImportCall(call, "rm", "node:fs/promises")
      && identifierResolvesTo(target, root)
      && options !== undefined
      && isExactCleanupOptions(options);
  }
  if (!Node.isTryStatement(statement)) return false;
  const nestedFinally = statement.getFinallyBlock();
  return nestedFinally !== undefined && blockGuaranteesRootRemoval(nestedFinally, root);
};

const blockGuaranteesRootRemoval = (block: Block, root: VariableDeclaration): boolean => {
  const statements = block.getStatements();
  const [statement] = statements;
  return statements.length === 1 && statement !== undefined && isGuaranteedRootRemoval(statement, root);
};

const finallyCleansRoot = (
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
  root: VariableDeclaration,
): boolean => {
  const finallyBlock = boundary.getFinallyBlock();
  return finallyBlock !== undefined && blockGuaranteesRootRemoval(finallyBlock, root);
};

const callResolvesToRepoFunction = (
  expression: Node,
  functionName: string,
  modulePath: string,
): boolean => expression.getType().getCallSignatures().some((signature) => {
  const declaration = signature.getDeclaration();
  if (toRepoPath(declaration.getSourceFile().getFilePath()) !== modulePath) return false;
  if (Node.isFunctionDeclaration(declaration)) return declaration.getName() === functionName;
  return declaration.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)?.getName() === functionName;
});

const directTargetImport = (
  source: SourceFile,
  functionName: string,
  modulePath: string,
) => {
  const moduleImports = source.getImportDeclarations().filter((declaration) => {
    const importedSource = declaration.getModuleSpecifierSourceFile();
    return importedSource !== undefined && toRepoPath(importedSource.getFilePath()) === modulePath;
  });
  if (moduleImports.some((declaration) =>
    declaration.getDefaultImport() !== undefined || declaration.getNamespaceImport() !== undefined)) return null;
  const targetSpecifiers = moduleImports
    .flatMap((declaration) => declaration.getNamedImports())
    .filter((specifier) => specifier.getName() === functionName);
  return targetSpecifiers.length === 1 ? targetSpecifiers[0] : null;
};

const targetReferenceIsDirectCall = (
  reference: Node,
  targetImport: Node,
): boolean => {
  const parent = reference.getParent();
  return identifierResolvesTo(reference, targetImport)
    && Node.isCallExpression(parent)
    && parent.getExpression() === reference;
};

const allTargetImportReferencesAreDirectCalls = (
  source: SourceFile,
  targetImport: Node,
): boolean => source.getDescendants().every((node) => {
  if (!Node.isIdentifier(node)) return true;
  if (node.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) return true;
  if (!identifierResolvesTo(node, targetImport)) return true;
  return targetReferenceIsDirectCall(node, targetImport);
});

const isFunctionScope = (node: Node): boolean =>
  Node.isArrowFunction(node) || Node.isFunctionExpression(node) || Node.isFunctionDeclaration(node);

const callHasControlledExecutionScope = (
  call: CallExpression,
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
  governedServer: VariableDeclaration | undefined,
): boolean => {
  const ancestors = call.getAncestors();
  const boundaryIndex = ancestors.findIndex((ancestor) => ancestor === boundary.getTryBlock());
  if (boundaryIndex < 0 || isDefinitelyUnreachable(call, boundary.getTryBlock())) return false;
  const scopes = ancestors
    .slice(0, boundaryIndex)
    .filter(isFunctionScope);
  if (scopes.length === 0) return true;
  const [scope] = scopes;
  const parent = scope?.getParent();
  return scopes.length === 1
    && governedServer !== undefined
    && parent !== undefined
    && Node.isCallExpression(parent)
    && governedServer.getInitializer() === parent
    && isNodeImportCall(parent, "createServer", "node:http");
};

const hasOnlyTerminalPassAfter = (
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
): boolean => {
  const siblings = boundary.getNextSiblings();
  const [statement] = siblings;
  if (siblings.length !== 1 || !Node.isExpressionStatement(statement)) return false;
  const expression = statement.getExpression();
  if (!Node.isCallExpression(expression)) return false;
  const callee = expression.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "write") return false;
  const stdout = callee.getExpression();
  const [message] = expression.getArguments();
    return Node.isPropertyAccessExpression(stdout)
    && stdout.getName() === "stdout"
    && isGlobalIdentifier(stdout.getExpression(), "process")
    && Node.isStringLiteral(message)
    && message.getLiteralText().startsWith("[ACCEPTANCE]")
    && message.getLiteralText().endsWith("PASS\n");
};

const serverDeclarationInsideBoundary = (
  source: SourceFile,
  serverVariable: string,
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
): VariableDeclaration | null => {
  const server = uniqueNodeHttpServerDeclaration(source);
  return server !== null
    && server.getName() === serverVariable
    && server.getFirstAncestor((ancestor) => ancestor === boundary.getTryBlock()) === boundary.getTryBlock()
    ? server
    : null;
};

const guardedServerCloseBlock = (block: Block, server: VariableDeclaration): Block | null => {
  const [statement] = block.getStatements();
  if (block.getStatements().length !== 1 || !Node.isIfStatement(statement)) return null;
  const condition = statement.getExpression();
  if (!Node.isPropertyAccessExpression(condition) || condition.getName() !== "listening"
    || !identifierResolvesTo(condition.getExpression(), server)) return null;
  const thenStatement = statement.getThenStatement();
  return Node.isBlock(thenStatement) ? thenStatement : null;
};

const awaitedPromiseExecutor = (block: Block): ArrowFunction | null => {
  const [statement] = block.getStatements();
  if (block.getStatements().length !== 1 || !Node.isExpressionStatement(statement)) return null;
  const awaited = statement.getExpression();
  if (!Node.isAwaitExpression(awaited)) return null;
  const awaitedExpression = awaited.getExpression();
  if (!Node.isNewExpression(awaitedExpression)) return null;
  const promise = awaitedExpression;
  const promiseExpression = promise.getExpression();
  if (!isGlobalIdentifier(promiseExpression, "Promise")) return null;
  const executor = promise.getArguments()[0];
  return Node.isArrowFunction(executor) ? executor : null;
};

const closeCallbackSettlesPromise = (
  callback: ArrowFunction,
  resolveParameter: Node,
  rejectParameter: Node,
): boolean => {
  const [errorParameter] = callback.getParameters();
  const callbackBody = callback.getBody();
  if (callback.getParameters().length !== 1 || !errorParameter
    || !Node.isConditionalExpression(callbackBody)
    || !identifierResolvesTo(callbackBody.getCondition(), errorParameter)) return false;
  const rejected = callbackBody.getWhenTrue();
  const resolved = callbackBody.getWhenFalse();
  if (!Node.isCallExpression(rejected) || !Node.isCallExpression(resolved)) return false;
  const rejectedCallee = rejected.getExpression();
  const resolvedCallee = resolved.getExpression();
  const [rejectedError] = rejected.getArguments();
  return Node.isIdentifier(rejectedCallee)
    && identifierResolvesTo(rejectedCallee, rejectParameter)
    && rejected.getArguments().length === 1
    && identifierResolvesTo(rejectedError, errorParameter)
    && Node.isIdentifier(resolvedCallee)
    && identifierResolvesTo(resolvedCallee, resolveParameter)
    && resolved.getArguments().length === 0;
};

const executorClosesServer = (executor: ArrowFunction, server: VariableDeclaration): boolean => {
  const [resolveParameter, rejectParameter] = executor.getParameters();
  if (executor.getParameters().length !== 2 || !resolveParameter || !rejectParameter) return false;
  const executorBody = executor.getBody();
  if (!Node.isCallExpression(executorBody)) return false;
  const callee = executorBody.getExpression();
  const [callback] = executorBody.getArguments();
  return Node.isPropertyAccessExpression(callee)
    && callee.getName() === "close"
    && identifierResolvesTo(callee.getExpression(), server)
    && executorBody.getArguments().length === 1
    && Node.isArrowFunction(callback)
    && closeCallbackSettlesPromise(callback, resolveParameter, rejectParameter);
};

const blockHasAwaitedServerClose = (block: Block, server: VariableDeclaration): boolean => {
  const closeBlock = guardedServerCloseBlock(block, server);
  const executor = closeBlock ? awaitedPromiseExecutor(closeBlock) : null;
  return executor !== null && executorClosesServer(executor, server);
};

const blockGuaranteesServerClose = (block: Block, server: VariableDeclaration): boolean => {
  if (blockHasAwaitedServerClose(block, server)) return true;
  const [statement] = block.getStatements();
  if (block.getStatements().length !== 1 || !Node.isTryStatement(statement)) return false;
  const finallyBlock = statement.getFinallyBlock();
  return finallyBlock !== undefined && blockGuaranteesServerClose(finallyBlock, server);
};

const serverClosesInImmediateBoundary = (server: VariableDeclaration): boolean => {
  const statement = server.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  const boundary = statement?.getNextSiblingIfKind(SyntaxKind.TryStatement);
  const finallyBlock = boundary?.getFinallyBlock();
  return finallyBlock !== undefined && blockGuaranteesServerClose(finallyBlock, server);
};

const serverLifecycleIsBounded = (
  source: SourceFile,
  input: DeliveryCase,
  root: VariableDeclaration,
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
): boolean => {
  if (!input.serverVariable) return true;
  const server = serverDeclarationInsideBoundary(source, input.serverVariable, boundary);
  return server !== null
    && serverClosesInImmediateBoundary(server)
    && finallyCleansRoot(boundary, root);
};

const deliveryCallsAreBounded = (
  source: SourceFile,
  input: DeliveryCase,
  deliveryDirectory: VariableDeclaration,
  boundary: NonNullable<ReturnType<typeof immediateCleanupBoundary>>,
): boolean => {
  const targetImport = directTargetImport(source, input.functionName, input.modulePath);
  if (!targetImport) return false;
  const governedServer = input.serverVariable
    ? serverDeclarationInsideBoundary(source, input.serverVariable, boundary) ?? undefined
    : undefined;
  if (input.serverVariable && !governedServer) return false;
  const calls = source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => callResolvesToRepoFunction(call.getExpression(), input.functionName, input.modulePath));
  return allTargetImportReferencesAreDirectCalls(source, targetImport)
    && calls.length > 0 && calls.every((call) => {
    if (!targetReferenceIsDirectCall(call.getExpression(), targetImport)) return false;
    const argument = call.getArguments()[input.deliveryArgumentIndex];
    return identifierResolvesTo(argument, deliveryDirectory)
      && call.getFirstAncestor((ancestor) => ancestor === boundary.getTryBlock()) === boundary.getTryBlock()
      && callHasControlledExecutionScope(call, boundary, governedServer);
  });
};

const isDeliveryCaseIsolated = (source: SourceFile, input: DeliveryCase): boolean => {
  const root = temporaryRootDeclaration(source, input.rootVariable);
  if (!root) return false;
  const boundary = immediateCleanupBoundary(root);
  const deliveryDirectory = deliveryDirectoryDeclaration(source, input, root);
  return boundary !== null
    && deliveryDirectory !== null
    && deliveryDirectory.getFirstAncestor((ancestor) => ancestor === boundary.getTryBlock()) === boundary.getTryBlock()
    && deliveryCallsAreBounded(source, input, deliveryDirectory, boundary)
    && finallyCleansRoot(boundary, root)
    && serverLifecycleIsBounded(source, input, root, boundary)
    && hasOnlyTerminalPassAfter(boundary);
};

export const inspectAcceptanceDeliveryIsolation = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const findings: InspectorFinding[] = [];
  for (const input of deliveryCases) {
    const source = context.project.getSourceFile(resolveFromRepo(input.filePath));
    if (source && isDeliveryCaseIsolated(source, input)) continue;
    findings.push(createFinding({
      checkId: "audit-system/ci-full-entry-gate",
      lawId,
      filePath: input.filePath,
      message: "Acceptance delivery must use symbol-bound imports, derive its injected directory from tmpdir-backed mkdtemp, and clean the same root in the immediately enclosing finally with recursive+force.",
    }));
  }
  const persistence = inspectTaskPersistenceIsolation(context, lawId);
  findings.push(...persistence.findings);
  return {
    findings,
    inspectedFiles: [...deliveryCases.map(({ filePath }) => filePath), ...persistence.inspectedFiles],
  };
};
