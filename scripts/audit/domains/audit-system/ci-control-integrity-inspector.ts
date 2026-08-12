import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type Node as MorphNode,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { nodeReferencesDeclaration, resolvesTo, variableCall } from "./ci-integrity-ast.js";
import { inspectCiPhaseIntegrity } from "./ci-phase-integrity-inspector.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";

const commandRunnerPath = "scripts/audit/ci-command-runner.ts";
const auditPlanRunnerPath = "scripts/audit/ci-audit-plan-runner.ts";
const auditPlanWorkerBootstrapPath = "scripts/audit/core/run-generated-plan-worker.mjs";
const auditPlanWorkerPath = "scripts/audit/core/run-generated-plan-worker.ts";

const isGlobalIdentifier = (node: MorphNode | undefined, name: string): boolean =>
  Node.isIdentifier(node)
  && node.getSymbol()?.getEscapedName().toString() === name
  && (node.getSymbol()?.getDeclarations().every((declaration) =>
    declaration.getSourceFile().isDeclarationFile()) ?? false);

const directCalls = (functionNode: ArrowFunction): CallExpression[] =>
  functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === functionNode
      && !isDefinitelyUnreachable(call, functionNode));

const importSpecifier = (source: SourceFile, name: string, moduleName: string): MorphNode | undefined =>
  source.getImportDeclarations()
    .find((declaration) => declaration.getModuleSpecifierValue() === moduleName)
    ?.getNamedImports().find((specifier) => specifier.getName() === name);

const returnedPromiseExecutor = (functionNode: ArrowFunction): ArrowFunction | null => {
  const body = functionNode.getBody();
  const expression = Node.isParenthesizedExpression(body) ? body.getExpression() : body;
  if (!Node.isNewExpression(expression) || !isGlobalIdentifier(expression.getExpression(), "Promise")) return null;
  const executor = expression.getArguments()[0];
  return Node.isArrowFunction(executor) ? executor : null;
};

const propertyUsesVariable = (
  node: MorphNode | undefined,
  propertyName: string,
  variable: VariableDeclaration,
): boolean => Node.isPropertyAccessExpression(node)
  && node.getName() === propertyName
  && resolvesTo(node.getExpression(), variable);

const globalStaticCall = (
  node: MorphNode | undefined,
  globalName: string,
  methodName: string,
): node is CallExpression => {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  return Node.isPropertyAccessExpression(callee)
    && callee.getName() === methodName
    && isGlobalIdentifier(callee.getExpression(), globalName);
};

const callWithExactArgument = (
  node: MorphNode | undefined,
  declaration: MorphNode,
  argument: MorphNode,
): node is CallExpression => Node.isCallExpression(node)
  && resolvesTo(node.getExpression(), declaration)
  && node.getArguments().length === 1
  && resolvesTo(node.getArguments()[0], argument);

const boundedWaitDeadline = (body: import("ts-morph").Block): VariableDeclaration | null => {
  const deadline = body.getVariableDeclaration("deadlineMs");
  const initializer = deadline?.getInitializer();
  const duration = Node.isBinaryExpression(initializer) ? initializer.getRight() : undefined;
  return deadline && Node.isBinaryExpression(initializer)
    && initializer.getOperatorToken().getKind() === SyntaxKind.PlusToken
    && globalStaticCall(initializer.getLeft(), "Date", "now")
    && Node.isNumericLiteral(duration)
    && Number(duration.getLiteralText().replaceAll("_", "")) === 5_000 ? deadline : null;
};

const boundedWaitLoop = (
  body: import("ts-morph").Block, pid: MorphNode, alive: MorphNode, delay: MorphNode, deadline: MorphNode,
): boolean => {
  const loops = body.getStatements().filter(Node.isWhileStatement);
  const loop = loops[0];
  if (loops.length !== 1 || !loop || !Node.isBinaryExpression(loop.getExpression())) return false;
  const condition = loop.getExpression().asKindOrThrow(SyntaxKind.BinaryExpression);
  const beforeDeadline = condition.getRight();
  const statement = loop.getStatement();
  const awaited = Node.isExpressionStatement(statement)
    ? statement.getExpressionIfKind(SyntaxKind.AwaitExpression)?.getExpressionIfKind(SyntaxKind.CallExpression) : undefined;
  const duration = awaited?.getArguments()[0];
  return condition.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken
    && callWithExactArgument(condition.getLeft(), alive, pid) && Node.isBinaryExpression(beforeDeadline)
    && beforeDeadline.getOperatorToken().getKind() === SyntaxKind.LessThanToken
    && globalStaticCall(beforeDeadline.getLeft(), "Date", "now") && resolvesTo(beforeDeadline.getRight(), deadline)
    && awaited !== undefined && resolvesTo(awaited.getExpression(), delay) && awaited.getArguments().length === 1
    && Node.isNumericLiteral(duration) && Number(duration.getLiteralText().replaceAll("_", "")) === 50;
};

const boundedWaitReturn = (body: import("ts-morph").Block, alive: MorphNode, pid: MorphNode): boolean => {
  const returns = body.getStatements().filter(Node.isReturnStatement);
  const returned = returns[0]?.getExpression();
  return returns.length === 1 && Node.isPrefixUnaryExpression(returned)
    && returned.getOperatorToken() === SyntaxKind.ExclamationToken
    && callWithExactArgument(returned.getOperand(), alive, pid);
};

const waitHelperIsBounded = (source: SourceFile, waitDeclaration: VariableDeclaration): boolean => {
  const waitFunction = waitDeclaration.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = waitFunction?.getBody();
  const pid = waitFunction?.getParameters()[0];
  const aliveDeclaration = source.getVariableDeclaration("processGroupIsAlive");
  const delayDeclaration = source.getVariableDeclaration("delay");
  if (!waitFunction?.isAsync() || !Node.isBlock(body) || !pid || !aliveDeclaration || !delayDeclaration) return false;
  const deadline = boundedWaitDeadline(body);
  return deadline !== null && boundedWaitLoop(body, pid, aliveDeclaration, delayDeclaration, deadline)
    && boundedWaitReturn(body, aliveDeclaration, pid);
};

type CommandControl = {
  child: VariableDeclaration;
  deadline: VariableDeclaration;
  deadlineCallback: ArrowFunction;
  executor: ArrowFunction;
  executorBody: import("ts-morph").Block;
};

const readCommandControl = (source: SourceFile): CommandControl | null => {
  const execute = source.getVariableDeclaration("executeBoundedCommand")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const executor = execute ? returnedPromiseExecutor(execute) : null;
  const body = executor?.getBody();
  if (!execute || !executor || !Node.isBlock(body)) return null;
  const spawn = importSpecifier(source, "spawn", "node:child_process");
  const child = body.getVariableDeclaration("child");
  const deadline = body.getVariableDeclaration("deadline");
  const deadlineCall = deadline?.getInitializerIfKind(SyntaxKind.CallExpression);
  const callback = deadlineCall?.getArguments()[0];
  const timeout = execute.getParameters()[1];
  const authentic = spawn && variableCall(child, spawn) && deadline && deadlineCall && timeout
    && isGlobalIdentifier(deadlineCall.getExpression(), "setTimeout")
    && resolvesTo(deadlineCall.getArguments()[1], timeout) && Node.isArrowFunction(callback);
  return authentic && child ? { child, deadline, deadlineCallback: callback, executor, executorBody: body } : null;
};

const readTimeoutCleanup = (source: SourceFile, control: CommandControl) => {
  const iife = control.deadlineCallback.getDescendantsOfKind(SyntaxKind.ArrowFunction).find((arrow) => {
    const wrapped = arrow.getParentIfKind(SyntaxKind.ParenthesizedExpression);
    return wrapped?.getParentIfKind(SyntaxKind.CallExpression)?.getExpression() === wrapped;
  });
  const terminate = source.getVariableDeclaration("terminateProcessGroup");
  const wait = source.getVariableDeclaration("waitForProcessGroupTermination");
  const finish = control.executorBody.getVariableDeclaration("finish");
  const finishFunction = finish?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  return iife && terminate && wait && finish && finishFunction ? { iife, terminate, wait, finish, finishFunction } : null;
};

const timeoutCleanupIsAuthentic = (control: CommandControl, cleanup: NonNullable<ReturnType<typeof readTimeoutCleanup>>): boolean => {
  const calls = directCalls(cleanup.iife);
  const terminations = calls.filter((call) => resolvesTo(call.getExpression(), cleanup.terminate));
  const signals = new Set(terminations.flatMap((call) => {
    const signal = call.getArguments()[1];
    return Node.isStringLiteral(signal) ? [signal.getLiteralText()] : [];
  }));
  const waitCall = calls.find((call) => resolvesTo(call.getExpression(), cleanup.wait));
  const waitResult = waitCall?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  const finishCall = calls.find((call) => resolvesTo(call.getExpression(), cleanup.finish));
  const outcome = finishCall?.getArguments()[0];
  const property = Node.isObjectLiteralExpression(outcome) ? outcome.getProperty("cleanupVerified") : undefined;
  const value = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
  return terminations.length === 2 && signals.has("SIGTERM") && signals.has("SIGKILL")
    && terminations.every((call) => propertyUsesVariable(call.getArguments()[0], "pid", control.child))
    && waitCall !== undefined && propertyUsesVariable(waitCall.getArguments()[0], "pid", control.child)
    && waitResult !== undefined && resolvesTo(value, waitResult);
};

const finishIsAuthentic = (control: CommandControl, finish: ArrowFunction): boolean => {
  const calls = directCalls(finish);
  const resolve = control.executor.getParameters()[0];
  const clears = calls.some((call) => isGlobalIdentifier(call.getExpression(), "clearTimeout")
    && resolvesTo(call.getArguments()[0], control.deadline));
  const settles = resolve !== undefined && calls.some((call) => resolvesTo(call.getExpression(), resolve));
  const unrefs = control.executor.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "unref"
      && resolvesTo(callee.getExpression(), control.deadline);
  });
  return clears && settles && !unrefs;
};

const terminateHelperIsAuthentic = (declaration: VariableDeclaration): boolean => {
  const helper = declaration.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const [pid, signal] = helper?.getParameters() ?? [];
  const killCalls = helper ? directCalls(helper).filter((call) => {
    const callee = call.getExpression();
    const receiver = Node.isPropertyAccessExpression(callee) && callee.getName() === "kill"
      ? callee.getExpression() : undefined;
    return Node.isIdentifier(receiver) && receiver.getSymbol()?.getEscapedName().toString() === "process"
      && (receiver.getSymbol()?.getDeclarations().every((item) => item.getSourceFile().isDeclarationFile()) ?? false);
  }) : [];
  return pid !== undefined && signal !== undefined && killCalls.length === 2
    && killCalls.every((call) => nodeReferencesDeclaration(call.getArguments()[0], pid)
      && resolvesTo(call.getArguments()[1], signal));
};

const commandCleanupIsBounded = (source: SourceFile | undefined): boolean => {
  if (!source) return false;
  const control = readCommandControl(source);
  const cleanup = control ? readTimeoutCleanup(source, control) : null;
  return control !== null && cleanup !== null && timeoutCleanupIsAuthentic(control, cleanup)
    && finishIsAuthentic(control, cleanup.finishFunction)
    && terminateHelperIsAuthentic(cleanup.terminate)
    && waitHelperIsBounded(source, cleanup.wait);
};

type WorkerRuntime = {
  executor: ArrowFunction;
  body: import("ts-morph").Block;
};
type WorkerControl = WorkerRuntime & {
  worker: VariableDeclaration;
  deadline: VariableDeclaration;
  deadlineCallback: ArrowFunction;
  failure: VariableDeclaration;
  resolve: MorphNode;
  reject: MorphNode;
  pending: VariableDeclaration;
  validator: VariableDeclaration;
};

const readWorkerRuntime = (source: SourceFile): WorkerRuntime | null => {
  const run = source.getVariableDeclaration("runGeneratedPlanWithDeadline")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const executor = run ? returnedPromiseExecutor(run) : null;
  const body = executor?.getBody();
  return executor && Node.isBlock(body) ? { executor, body } : null;
};

const workerConstructionIsAuthentic = (source: SourceFile, runtime: WorkerRuntime): boolean => {
  const imported = importSpecifier(source, "Worker", "node:worker_threads");
  const worker = runtime.body.getVariableDeclaration("worker");
  const created = worker?.getInitializerIfKind(SyntaxKind.NewExpression);
  const url = created?.getArguments()[0];
  const path = Node.isNewExpression(url) ? url.getArguments()[0] : undefined;
  const base = Node.isNewExpression(url) ? url.getArguments()[1] : undefined;
  const meta = Node.isPropertyAccessExpression(base) && base.getName() === "url" ? base.getExpression() : undefined;
  return imported !== undefined && created !== undefined && resolvesTo(created.getExpression(), imported)
    && Node.isNewExpression(url) && isGlobalIdentifier(url.getExpression(), "URL")
    && Node.isStringLiteral(path) && path.getLiteralText() === "./core/run-generated-plan-worker.mjs"
    && Node.isMetaProperty(meta);
};

const readWorkerControl = (source: SourceFile, runtime: WorkerRuntime): WorkerControl | null => {
  const worker = runtime.body.getVariableDeclaration("worker");
  const deadline = runtime.body.getVariableDeclaration("deadline");
  const deadlineCall = deadline?.getInitializerIfKind(SyntaxKind.CallExpression);
  const callback = deadlineCall?.getArguments()[0];
  const timeout = source.getVariableDeclaration("AUDIT_PLAN_TIMEOUT_MS");
  const failure = runtime.body.getVariableDeclaration("settleFailureAfterTermination");
  const [resolve, reject] = runtime.executor.getParameters();
  const pending = runtime.body.getVariableDeclaration("pendingResult");
  const validator = source.getVariableDeclaration("validateGeneratedPlanWorkerResult");
  const valid = workerConstructionIsAuthentic(source, runtime) && worker && deadline && deadlineCall && timeout
    && Node.isArrowFunction(callback) && isGlobalIdentifier(deadlineCall.getExpression(), "setTimeout")
    && resolvesTo(deadlineCall.getArguments()[1], timeout) && failure && resolve && reject && pending && validator;
  return valid ? { ...runtime, worker, deadline, deadlineCallback: callback, failure, resolve, reject, pending, validator } : null;
};

const workerTerminationIsAuthentic = (control: WorkerControl): boolean => {
  const helper = control.failure.getInitializerIfKind(SyntaxKind.ArrowFunction);
  if (!helper) return false;
  const terminate = directCalls(helper).find((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "terminate"
      && resolvesTo(callee.getExpression(), control.worker);
  });
  const thenAccess = terminate?.getParentIfKind(SyntaxKind.PropertyAccessExpression);
  const thenCall = thenAccess?.getParentIfKind(SyntaxKind.CallExpression);
  const handlers = thenCall?.getArguments().filter(Node.isArrowFunction) ?? [];
  const handlersSettle = handlers.length === 2 && handlers.every((handler) => {
    const calls = directCalls(handler);
    return calls.some((call) => isGlobalIdentifier(call.getExpression(), "clearTimeout")
      && resolvesTo(call.getArguments()[0], control.deadline))
      && calls.some((call) => resolvesTo(call.getExpression(), control.reject));
  });
  const timeoutCalls = directCalls(control.deadlineCallback);
  return thenAccess?.getName() === "then" && handlersSettle && timeoutCalls.length === 1
    && timeoutCalls.every((call) => resolvesTo(call.getExpression(), control.failure));
};

const workerListener = (control: WorkerControl, eventName: string): MorphNode | undefined =>
  directCalls(control.executor).flatMap((call) => {
    const callee = call.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== "once"
      || !resolvesTo(callee.getExpression(), control.worker)) return [];
    const event = call.getArguments()[0];
    const callback = call.getArguments()[1];
    return Node.isStringLiteral(event) && event.getLiteralText() === eventName && callback ? [callback] : [];
  })[0];

const workerMessageIsAuthentic = (control: WorkerControl): boolean => {
  const callback = workerListener(control, "message");
  if (!Node.isArrowFunction(callback)) return false;
  const message = callback.getParameters()[0];
  const calls = directCalls(callback);
  const validation = calls.find((call) => resolvesTo(call.getExpression(), control.validator));
  const assignment = validation?.getFirstAncestorByKind(SyntaxKind.BinaryExpression);
  const pendingWrites = control.executor.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .filter((candidate) => resolvesTo(candidate.getLeft(), control.pending));
  const authenticates = message && validation && resolvesTo(validation.getArguments()[0], message)
    && assignment?.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    && resolvesTo(assignment.getLeft(), control.pending)
    && pendingWrites.length === 1 && pendingWrites[0] === assignment;
  const failsClosed = calls.some((call) => resolvesTo(call.getExpression(), control.failure));
  const doesNotSettle = calls.every((call) => !resolvesTo(call.getExpression(), control.resolve)
    && !(isGlobalIdentifier(call.getExpression(), "clearTimeout")
      && resolvesTo(call.getArguments()[0], control.deadline)));
  return Boolean(authenticates && failsClosed && doesNotSettle);
};

const guardRejectsAndReturns = (
  guard: import("ts-morph").IfStatement,
  exit: ArrowFunction,
  reject: MorphNode,
): boolean => {
  const branch = guard.getThenStatement();
  const calls = branch.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === exit
      && !isDefinitelyUnreachable(call, exit));
  const returns = branch.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((statement) => statement.getFirstAncestor(Node.isFunctionLikeDeclaration) === exit);
  return calls.some((call) => resolvesTo(call.getExpression(), reject)) && returns.length === 1;
};

const isNonZeroExitGuard = (guard: import("ts-morph").IfStatement, code: MorphNode): boolean => {
  const condition = guard.getExpression();
  const right = Node.isBinaryExpression(condition) ? condition.getRight() : undefined;
  return Node.isBinaryExpression(condition)
    && condition.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
    && resolvesTo(condition.getLeft(), code) && Node.isNumericLiteral(right)
    && Number(right.getLiteralText().replaceAll("_", "")) === 0;
};

const isMissingResultGuard = (guard: import("ts-morph").IfStatement, pending: MorphNode): boolean => {
  const condition = guard.getExpression();
  return Node.isPrefixUnaryExpression(condition)
    && condition.getOperatorToken() === SyntaxKind.ExclamationToken
    && resolvesTo(condition.getOperand(), pending);
};

const exitGuardsAreAuthentic = (
  exit: ArrowFunction,
  control: WorkerControl,
  successSettlement: CallExpression,
): boolean => {
  const [code] = exit.getParameters();
  const body = exit.getBody();
  if (!code || !Node.isBlock(body)) return false;
  const guards = body.getStatements().filter(Node.isIfStatement);
  const nonZero = guards.find((guard) => isNonZeroExitGuard(guard, code));
  const missing = guards.find((guard) => isMissingResultGuard(guard, control.pending));
  const successStatement = successSettlement.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  return nonZero !== undefined && missing !== undefined && successStatement?.getParent() === body
    && nonZero.getStart() < successSettlement.getStart()
    && missing.getStart() < successSettlement.getStart()
    && nonZero.getStart() < missing.getStart()
    && guardRejectsAndReturns(nonZero, exit, control.reject)
    && guardRejectsAndReturns(missing, exit, control.reject);
};

const workerExitIsAuthentic = (control: WorkerControl): boolean => {
  const exit = workerListener(control, "exit");
  if (!Node.isArrowFunction(exit)) return false;
  const calls = directCalls(exit);
  const clears = calls.some((call) => isGlobalIdentifier(call.getExpression(), "clearTimeout")
    && resolvesTo(call.getArguments()[0], control.deadline));
  const resolves = calls.some((call) => resolvesTo(call.getExpression(), control.resolve)
    && resolvesTo(call.getArguments()[0], control.pending));
  const resolveCall = calls.find((call) => resolvesTo(call.getExpression(), control.resolve));
  return clears && resolves && resolveCall !== undefined
    && exitGuardsAreAuthentic(exit, control, resolveCall)
    && resolvesTo(workerListener(control, "error"), control.failure);
};

const workerCleanupIsBounded = (source: SourceFile | undefined): boolean => {
  if (!source) return false;
  const runtime = readWorkerRuntime(source);
  const control = runtime ? readWorkerControl(source, runtime) : null;
  return control !== null && workerTerminationIsAuthentic(control)
    && workerMessageIsAuthentic(control) && workerExitIsAuthentic(control);
};

const workerPostCalls = (source: SourceFile, parentPort: MorphNode): CallExpression[] =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "postMessage"
      && resolvesTo(callee.getExpression(), parentPort);
  });

const authenticSuccessPost = (calls: readonly CallExpression[], result: VariableDeclaration) => calls.find((call) => {
  const message = call.getArguments()[0];
  const ok = Node.isObjectLiteralExpression(message) ? message.getProperty("ok") : undefined;
  const returned = Node.isObjectLiteralExpression(message) ? message.getProperty("result") : undefined;
  return Node.isPropertyAssignment(ok) && Node.isTrueLiteral(ok.getInitializer())
    && Node.isShorthandPropertyAssignment(returned)
    && (returned.getValueSymbol()?.getDeclarations().includes(result) ?? false);
});

const authenticFailurePost = (calls: readonly CallExpression[]) => calls.find((call) => {
  const message = call.getArguments()[0];
  const ok = Node.isObjectLiteralExpression(message) ? message.getProperty("ok") : undefined;
  const error = Node.isObjectLiteralExpression(message) ? message.getProperty("error") : undefined;
  return Node.isPropertyAssignment(ok) && Node.isFalseLiteral(ok.getInitializer())
    && Node.isPropertyAssignment(error);
});

const workerAdapterIsAuthentic = (source: SourceFile | undefined): boolean => {
  if (!source) return false;
  const parentPort = importSpecifier(source, "parentPort", "node:worker_threads");
  const runner = importSpecifier(source, "runGeneratedPlan", "./run-generated-plan.js");
  const result = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "result");
  const run = result?.getInitializerIfKind(SyntaxKind.AwaitExpression)?.getExpressionIfKind(SyntaxKind.CallExpression);
  if (!parentPort || !runner || !result || !run || !resolvesTo(run.getExpression(), runner)) return false;
  const calls = workerPostCalls(source, parentPort);
  const success = authenticSuccessPost(calls, result);
  const failure = authenticFailurePost(calls);
  const execution = run.getFirstAncestorByKind(SyntaxKind.TryStatement);
  return calls.length === 2 && success !== undefined && failure !== undefined && execution !== undefined
    && success.getFirstAncestorByKind(SyntaxKind.TryStatement) === execution
    && failure.getFirstAncestorByKind(SyntaxKind.TryStatement) === execution;
};

const workerBootstrapIsAuthentic = (bootstrap: SourceFile | undefined): boolean => {
  if (!bootstrap) return false;
  const registerImport = importSpecifier(bootstrap, "register", "tsx/esm/api");
  const unregister = bootstrap.getVariableDeclaration("unregister");
  const registerCall = registerImport ? variableCall(unregister, registerImport) : null;
  const executionTry = bootstrap.getDescendantsOfKind(SyntaxKind.TryStatement)[0];
  const workerImport = executionTry?.getTryBlock().getDescendantsOfKind(SyntaxKind.AwaitExpression)
    .map((awaited) => awaited.getExpression())
    .find((expression) => {
      if (!Node.isCallExpression(expression)) return false;
      const importedPath = expression.getArguments()[0];
      return expression.getExpression().getKind() === SyntaxKind.ImportKeyword
        && Node.isStringLiteral(importedPath)
        && importedPath.getLiteralText() === "./run-generated-plan-worker.ts";
    });
  const unregisterAwait = executionTry?.getFinallyBlock()?.getDescendantsOfKind(SyntaxKind.AwaitExpression)
    .map((awaited) => awaited.getExpression())
    .find((expression) => Node.isCallExpression(expression)
      && unregister !== undefined
      && resolvesTo(expression.getExpression(), unregister));
  return Boolean(registerImport && unregister && registerCall && executionTry && workerImport && unregisterAwait);
};

const inspectCommandDeadlines = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectedFiles.add(commandRunnerPath);
  inspectedFiles.add(auditPlanRunnerPath);
  inspectedFiles.add(auditPlanWorkerBootstrapPath);
  inspectedFiles.add(auditPlanWorkerPath);
  const commandRunner = context.project.getSourceFile(resolveFromRepo(commandRunnerPath));
  const auditPlanRunner = context.project.getSourceFile(resolveFromRepo(auditPlanRunnerPath));
  const auditPlanWorkerBootstrap = context.project.getSourceFile(resolveFromRepo(auditPlanWorkerBootstrapPath))
    ?? context.project.addSourceFileAtPath(resolveFromRepo(auditPlanWorkerBootstrapPath));
  const auditPlanWorker = context.project.getSourceFile(resolveFromRepo(auditPlanWorkerPath));
  if (!commandCleanupIsBounded(commandRunner)
    || !workerCleanupIsBounded(auditPlanRunner)
    || !workerBootstrapIsAuthentic(auditPlanWorkerBootstrap)
    || !workerAdapterIsAuthentic(auditPlanWorker)) {
    findings.push(createFinding({
      checkId: "audit-system/ci-full-entry-gate",
      lawId,
      filePath: commandRunnerPath,
      message: "CI command process groups and the generated-plan worker must each have a hard deadline plus terminal cleanup.",
    }));
  }
};
export const inspectCiControlIntegrity = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  inspectCommandDeadlines(context, findings, inspectedFiles, lawId);
  inspectCiPhaseIntegrity(context, findings, inspectedFiles, lawId);
};
