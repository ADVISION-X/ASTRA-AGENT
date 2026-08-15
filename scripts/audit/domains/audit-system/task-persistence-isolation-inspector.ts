import {
  Node,
  SyntaxKind,
  VariableDeclarationKind,
  type ArrowFunction,
  type Block,
  type CallExpression,
  type Node as MorphNode,
  type ParameterDeclaration,
  type SourceFile,
  type TryStatement,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";
import { uniqueNodeHttpServerDeclaration } from "./node-http-server-inspector.js";

const acceptancePath = "scripts/acceptance/media-processing-task-persistence.acceptance.ts";
const routePath = "src/app/workbench-media-processing-routes.ts";
const scenarioContracts = [
  ["runInitialSnapshotFailureAcceptance", "initial-persist", "initial-delivery"],
  ["runTerminalSnapshotFailureAndConcurrencyAcceptance", "terminal-persist", "terminal-delivery"],
  ["runInterruptedRunningSnapshotAcceptance", "interrupted", "interrupted-delivery"],
  ["runDownloadsCopyFailureAcceptance", "downloads-failure", "downloads-delivery"],
] as const;

const isConst = (declaration: VariableDeclaration): boolean =>
  declaration.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const;

const resolvesTo = (node: MorphNode | undefined, declaration: MorphNode): boolean =>
  Node.isIdentifier(node)
  && (node.getSymbol()?.getDeclarations().includes(declaration) ?? false);

const directImport = (source: SourceFile, name: string, moduleName: string) => {
  const matches = source.getImportDeclarations().flatMap((declaration) => {
    const resolvedPath = declaration.getModuleSpecifierSourceFile();
    const exactModule = moduleName.startsWith("node:")
      ? declaration.getModuleSpecifierValue() === moduleName
      : resolvedPath !== undefined && toRepoPath(resolvedPath.getFilePath()) === moduleName;
    return exactModule
      ? declaration.getNamedImports().filter((specifier) => specifier.getName() === name)
      : [];
  });
  return matches.length === 1 ? matches[0] : null;
};

const directCall = (call: CallExpression, declaration: MorphNode): boolean =>
  resolvesTo(call.getExpression(), declaration);

const defaultPathJoin = (call: CallExpression): boolean => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "join") return false;
  const receiver = expression.getExpression();
  if (!Node.isIdentifier(receiver)) return false;
  return receiver.getSymbol()?.getDeclarations().some((declaration) =>
    Node.isImportClause(declaration)
    && declaration.getDefaultImport()?.getSymbol() === receiver.getSymbol()
    && declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)?.getModuleSpecifierValue() === "node:path") ?? false;
};

const exactRootJoin = (
  expression: MorphNode | undefined,
  root: MorphNode,
  suffix: string,
): boolean => {
  if (!Node.isCallExpression(expression) || !defaultPathJoin(expression)) return false;
  const [rootArgument, suffixArgument] = expression.getArguments();
  return expression.getArguments().length === 2
    && resolvesTo(rootArgument, root)
    && Node.isStringLiteral(suffixArgument)
    && suffixArgument.getLiteralText() === suffix;
};

const rootAndBoundary = (source: SourceFile): {
  boundary: TryStatement;
  root: VariableDeclaration;
} | null => {
  const roots = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === "acceptanceRoot");
  const root = roots[0];
  if (roots.length !== 1 || !root || !isConst(root)) return null;
  const awaited = root.getInitializerIfKind(SyntaxKind.AwaitExpression)?.getExpressionIfKind(SyntaxKind.CallExpression);
  const mkdtempImport = directImport(source, "mkdtemp", "node:fs/promises");
  const tmpdirImport = directImport(source, "tmpdir", "node:os");
  if (!awaited || !mkdtempImport || !tmpdirImport || !directCall(awaited, mkdtempImport)) return null;
  const mkdtempCalls = source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => directCall(call, mkdtempImport));
  const prefix = awaited.getArguments()[0];
  if (mkdtempCalls.length !== 1 || !Node.isCallExpression(prefix) || !defaultPathJoin(prefix)) return null;
  const [tmp, name] = prefix.getArguments();
  if (!Node.isCallExpression(tmp) || !directCall(tmp, tmpdirImport)
    || !Node.isStringLiteral(name) || name.getLiteralText() !== "grasseye-mp-persistence-") return null;
  const statement = root.getVariableStatement();
  const boundary = statement?.getNextSiblingIfKind(SyntaxKind.TryStatement);
  return boundary ? { boundary, root } : null;
};

const exactOptions = (node: MorphNode | undefined): boolean => {
  if (!Node.isObjectLiteralExpression(node)) return false;
  const properties = node.getProperties();
  if (properties.length !== 2 || !properties.every(Node.isPropertyAssignment)) return false;
  const values = new Map(properties.map((property) => [property.getName(), property.getInitializer()?.getKind()]));
  return values.size === 2
    && values.get("recursive") === SyntaxKind.TrueKeyword
    && values.get("force") === SyntaxKind.TrueKeyword;
};

const outerCleanupIsExact = (
  source: SourceFile,
  root: VariableDeclaration,
  boundary: TryStatement,
): boolean => {
  const rmImport = directImport(source, "rm", "node:fs/promises");
  const statements = boundary.getFinallyBlock()?.getStatements() ?? [];
  if (!rmImport || statements.length !== 1 || !Node.isExpressionStatement(statements[0])) return false;
  const awaited = statements[0].getExpression();
  const call = Node.isAwaitExpression(awaited) ? awaited.getExpressionIfKind(SyntaxKind.CallExpression) : undefined;
  const rootRemovals = rmImport ? source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((candidate) => directCall(candidate, rmImport) && resolvesTo(candidate.getArguments()[0], root)) : [];
  return rootRemovals.length === 1 && call !== undefined
    && directCall(call, rmImport)
    && resolvesTo(call.getArguments()[0], root)
    && exactOptions(call.getArguments()[1]);
};

const scenarioFunction = (source: SourceFile, name: string): {
  declaration: VariableDeclaration;
  functionNode: ArrowFunction;
  rootParameter: ParameterDeclaration;
} | null => {
  const declarations = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === name);
  const declaration = declarations.length === 1 ? declarations[0] : undefined;
  const functionNode = declaration?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const rootParameter = functionNode?.getParameters()[0];
  return declaration && isConst(declaration) && functionNode && rootParameter
    ? { declaration, functionNode, rootParameter }
    : null;
};

const uniqueRootDerivedVariable = (
  functionNode: ArrowFunction,
  name: string,
  rootParameter: ParameterDeclaration,
  suffix: string,
): boolean => {
  const declarations = functionNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === name);
  const declaration = declarations[0];
  return declarations.length === 1
    && declaration !== undefined
    && isConst(declaration)
    && exactRootJoin(declaration.getInitializer(), rootParameter, suffix);
};

const callsInside = (
  functionNode: ArrowFunction,
  declaration: MorphNode,
): CallExpression[] => functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
  .filter((call) => directCall(call, declaration));

const outsideArtifactIsRootDerived = (
  scenario: NonNullable<ReturnType<typeof scenarioFunction>>,
): boolean => {
  const outside = scenario.functionNode.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === "outsideArtifactPath");
  const declaration = outside[0];
  if (outside.length !== 1 || !declaration || !isConst(declaration)) return false;
  const initializer = declaration.getInitializer();
  if (!Node.isCallExpression(initializer) || !defaultPathJoin(initializer)) return false;
  const args = initializer.getArguments();
  return args.length === 3
    && resolvesTo(args[0], scenario.rootParameter)
    && Node.isStringLiteral(args[1]) && args[1].getLiteralText() === "outside-artifact"
    && Node.isStringLiteral(args[2]) && args[2].getLiteralText() === "artifact.webp";
};

const scenarioInvocationIsRootBound = (
  source: SourceFile,
  scenario: NonNullable<ReturnType<typeof scenarioFunction>>,
  root: VariableDeclaration,
  boundary: TryStatement,
): boolean => {
  const invocations = source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => directCall(call, scenario.declaration));
  const invocation = invocations[0];
  return invocations.length === 1
    && invocation !== undefined
    && resolvesTo(invocation.getArguments()[0], root)
    && invocation.getFirstAncestor((ancestor) => ancestor === boundary.getTryBlock()) === boundary.getTryBlock()
    && !isDefinitelyUnreachable(invocation, boundary.getTryBlock());
};

const scenarioContractHolds = (
  source: SourceFile,
  contract: typeof scenarioContracts[number],
  root: VariableDeclaration,
  boundary: TryStatement,
  withServer: VariableDeclaration,
): boolean => {
  const [name, dataSuffix, deliverySuffix] = contract;
  const scenario = scenarioFunction(source, name);
  if (!scenario || !uniqueRootDerivedVariable(scenario.functionNode, "dataDir", scenario.rootParameter, dataSuffix)) return false;
  if (name === "runDownloadsCopyFailureAcceptance" && !outsideArtifactIsRootDerived(scenario)) return false;
  const serverCalls = callsInside(scenario.functionNode, withServer);
  const serverCall = serverCalls[0];
  return serverCalls.length === 1 && serverCall !== undefined
    && !isDefinitelyUnreachable(serverCall, scenario.functionNode)
    && exactRootJoin(serverCall.getArguments()[1], scenario.rootParameter, deliverySuffix)
    && scenarioInvocationIsRootBound(source, scenario, root, boundary);
};

const scenarioContractsHold = (
  source: SourceFile,
  root: VariableDeclaration,
  boundary: TryStatement,
  withServer: VariableDeclaration,
): boolean => scenarioContracts.every((contract) =>
  scenarioContractHolds(source, contract, root, boundary, withServer));

const globalPromiseConstructor = (expression: MorphNode): boolean => {
  if (!Node.isIdentifier(expression)
    || expression.getSymbol()?.getEscapedName().toString() !== "Promise") return false;
  const declarations = expression.getSymbol()?.getDeclarations() ?? [];
  return declarations.length > 0 && declarations.every((declaration) => declaration.getSourceFile().isDeclarationFile());
};

const closeCallbackSettles = (
  callback: MorphNode | undefined,
  resolveParameter: ParameterDeclaration,
  rejectParameter: ParameterDeclaration,
): boolean => {
  if (!Node.isArrowFunction(callback)) return false;
  const [error] = callback.getParameters();
  const body = callback.getBody();
  if (!error || !Node.isConditionalExpression(body)) return false;
  const rejectCall = body.getWhenTrue();
  const resolveCall = body.getWhenFalse();
  return resolvesTo(body.getCondition(), error)
    && Node.isCallExpression(rejectCall)
    && Node.isIdentifier(rejectCall.getExpression())
    && resolvesTo(rejectCall.getExpression(), rejectParameter)
    && resolvesTo(rejectCall.getArguments()[0], error)
    && Node.isCallExpression(resolveCall)
    && Node.isIdentifier(resolveCall.getExpression())
    && resolvesTo(resolveCall.getExpression(), resolveParameter)
    && resolveCall.getArguments().length === 0;
};

const closeCallFromExecutor = (executor: import("ts-morph").ArrowFunction) => {
  const body = executor.getBody();
  if (Node.isCallExpression(body)) return body;
  const statements = Node.isBlock(body) ? body.getStatements() : [];
  return statements.length === 1 && Node.isExpressionStatement(statements[0])
    ? statements[0].getExpressionIfKind(SyntaxKind.CallExpression) : undefined;
};

const closeIsAwaitedAndSettled = (block: Block, server: VariableDeclaration): boolean => {
  const [statement] = block.getStatements();
  if (block.getStatements().length !== 1 || !Node.isExpressionStatement(statement)) return false;
  const awaited = statement.getExpression();
  if (!Node.isAwaitExpression(awaited)) return false;
  const promise = awaited.getExpression();
  if (!Node.isNewExpression(promise) || !globalPromiseConstructor(promise.getExpression())) return false;
  const executor = promise.getArguments()[0];
  if (!Node.isArrowFunction(executor) || executor.getParameters().length !== 2) return false;
  const [resolveParameter, rejectParameter] = executor.getParameters();
  if (!resolveParameter || !rejectParameter) return false;
  const close = closeCallFromExecutor(executor);
  const callee = close?.getExpression();
  return close !== undefined
    && Node.isPropertyAccessExpression(callee)
    && callee.getName() === "close"
    && resolvesTo(callee.getExpression(), server)
    && close.getArguments().length === 1
    && closeCallbackSettles(close.getArguments()[0], resolveParameter, rejectParameter);
};

const guardedCloseBlock = (block: Block, server: VariableDeclaration): Block | null => {
  const statements = block.getStatements();
  const guard = statements.length === 1 && Node.isIfStatement(statements[0]) ? statements[0] : undefined;
  const condition = guard?.getExpression();
  const thenStatement = guard?.getThenStatement();
  return guard && !guard.getElseStatement()
    && Node.isPropertyAccessExpression(condition)
    && condition.getName() === "listening"
    && resolvesTo(condition.getExpression(), server)
    && Node.isBlock(thenStatement)
    ? thenStatement
    : null;
};

const withServerFunction = (source: SourceFile): {
  declaration: VariableDeclaration;
  deliveryParameter: ParameterDeclaration;
  functionNode: ArrowFunction;
  runParameter: ParameterDeclaration;
} | null => {
  const declarations = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .filter((declaration) => declaration.getName() === "withServer");
  const withServer = declarations.length === 1 ? declarations[0] : undefined;
  const functionNode = withServer?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const deliveryParameter = functionNode?.getParameters()[1];
  const runParameter = functionNode?.getParameters()[2];
  return withServer && isConst(withServer) && functionNode && deliveryParameter && runParameter
    ? { declaration: withServer, deliveryParameter, functionNode, runParameter }
    : null;
};

const governedServer = (source: SourceFile, functionNode: ArrowFunction): VariableDeclaration | null => {
  const server = uniqueNodeHttpServerDeclaration(source);
  return server !== null
    && server.getName() === "server"
    && server.getFirstAncestor((ancestor) => ancestor === functionNode) === functionNode
    ? server
    : null;
};

const serverHandlerUsesDelivery = (
  source: SourceFile,
  server: VariableDeclaration,
  deliveryParameter: ParameterDeclaration,
): boolean => {
  const initializer = server.getInitializerIfKindOrThrow(SyntaxKind.CallExpression);
  const routeImport = directImport(source, "handleMediaProcessingRequest", routePath);
  const callback = initializer.getArguments()[0];
  if (!routeImport || !Node.isArrowFunction(callback)) return false;
  const routeCalls = callback.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => directCall(call, routeImport));
  const routeCall = routeCalls[0];
  return routeCalls.length === 1 && routeCall !== undefined
    && resolvesTo(routeCall.getArguments()[3], deliveryParameter);
};

const serverBoundaryRunsAndCloses = (
  server: VariableDeclaration,
  runParameter: ParameterDeclaration,
): boolean => {
  const boundary = server.getVariableStatement()?.getNextSiblingIfKind(SyntaxKind.TryStatement);
  const finallyBlock = boundary?.getFinallyBlock();
  const closeBlock = finallyBlock ? guardedCloseBlock(finallyBlock, server) : null;
  if (!boundary || !closeBlock || !closeIsAwaitedAndSettled(closeBlock, server)) return false;
  const runCalls = boundary.getTryBlock().getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => directCall(call, runParameter)
      && !isDefinitelyUnreachable(call, boundary.getTryBlock()));
  return runCalls.length === 1;
};

const withServerLifecycleIsExact = (source: SourceFile): VariableDeclaration | null => {
  const governedFunction = withServerFunction(source);
  if (!governedFunction) return null;
  const server = governedServer(source, governedFunction.functionNode);
  return server
    && serverHandlerUsesDelivery(source, server, governedFunction.deliveryParameter)
    && serverBoundaryRunsAndCloses(server, governedFunction.runParameter)
    ? governedFunction.declaration
    : null;
};

const terminalPassAfter = (source: SourceFile, boundary: TryStatement): boolean => {
  const trailing = source.getStatements().slice(source.getStatements().indexOf(boundary) + 1);
  const statement = trailing[0];
  if (trailing.length !== 1 || !Node.isExpressionStatement(statement)) return false;
  const call = statement.getExpression();
  if (!Node.isCallExpression(call)) return false;
  const expression = call.getExpression();
  const message = call.getArguments()[0];
  const stdout = Node.isPropertyAccessExpression(expression) ? expression.getExpression() : undefined;
  const processIdentifier = Node.isPropertyAccessExpression(stdout) ? stdout.getExpression() : undefined;
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "write"
    && Node.isPropertyAccessExpression(stdout)
    && stdout.getName() === "stdout"
    && Node.isIdentifier(processIdentifier)
    && processIdentifier.getSymbol()?.getEscapedName().toString() === "process"
    && (processIdentifier.getSymbol()?.getDeclarations().every((declaration) =>
      declaration.getSourceFile().isDeclarationFile()) ?? false)
    && Node.isStringLiteral(message)
    && message.getLiteralText() === "[ACCEPTANCE][media-processing-task-persistence] PASS\n";
};

const isIsolated = (source: SourceFile): boolean => {
  const governed = rootAndBoundary(source);
  const withServer = withServerLifecycleIsExact(source);
  return governed !== null
    && withServer !== null
    && outerCleanupIsExact(source, governed.root, governed.boundary)
    && scenarioContractsHold(source, governed.root, governed.boundary, withServer)
    && terminalPassAfter(source, governed.boundary);
};

export const inspectTaskPersistenceIsolation = (
  context: InspectorContext,
  lawId: string,
): { findings: InspectorFinding[]; inspectedFiles: string[] } => {
  const source = context.project.getSourceFile(resolveFromRepo(acceptancePath));
  if (source && isIsolated(source)) return { findings: [], inspectedFiles: [acceptancePath] };
  return {
    findings: [createFinding({
      checkId: "audit-system/ci-full-entry-gate",
      lawId,
      filePath: acceptancePath,
      message: "Media persistence acceptance must bind one tmpdir root to every data, outside-artifact and delivery path, govern its unique server through an immediate try/finally, await error-aware close completion, and clean the same root exactly once.",
    })],
    inspectedFiles: [acceptancePath],
  };
};
