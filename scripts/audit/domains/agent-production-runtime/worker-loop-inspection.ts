import { Node, SyntaxKind, type Block } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { LAWS, sourceFor } from "./contract-inspection.js";

const RUNTIME_LOOPS = "src/lib/local-runtime/production/runtime-loops.ts";
const BACKOFF_CEILING_MS = 30_000;
const STOP_FLAGS = new Set(["state.stopped", "state.draining"]);
const BREAKABLE = new Set([SyntaxKind.WhileStatement, SyntaxKind.DoStatement, SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement, SyntaxKind.ForOfStatement, SyntaxKind.SwitchStatement]);

const assignment = (node: Node | undefined): Readonly<{ left: string; right: Node }> | undefined => {
  const expression = Node.isExpressionStatement(node) ? node.getExpression() : node;
  return Node.isBinaryExpression(expression) && expression.getOperatorToken().getKind() === SyntaxKind.EqualsToken
    ? { left: expression.getLeft().getText(), right: expression.getRight() } : undefined;
};

const isBoundedWait = (statement: Node | undefined): boolean => {
  const awaited = Node.isExpressionStatement(statement) ? statement.getExpression() : undefined;
  const call = Node.isAwaitExpression(awaited) ? awaited.getExpression() : undefined;
  return Node.isCallExpression(call) && call.getExpression().getText() === "wait"
    && call.getArguments().map((argument) => argument.getText()).join(",") === "delay,state.abort.signal";
};

const isBoundedDelay = (right: Node): boolean => {
  if (!Node.isCallExpression(right) || right.getExpression().getText() !== "Math.min") return false;
  const ceiling = right.getArguments()[0];
  return Node.isNumericLiteral(ceiling) && Number(ceiling.getLiteralValue()) <= BACKOFF_CEILING_MS;
};

/** Whether a break/continue leaves or skips the worker loop itself rather than an inner loop or switch. */
const targetsWorkerLoop = (statement: Node, loop: Node): boolean => {
  if ((Node.isBreakStatement(statement) || Node.isContinueStatement(statement)) && statement.getLabel()) return true;
  const isBreak = Node.isBreakStatement(statement);
  const target = statement.getFirstAncestor((ancestor) => BREAKABLE.has(ancestor.getKind())
    && (isBreak || ancestor.getKind() !== SyntaxKind.SwitchStatement));
  return target === loop;
};
const isRuntimeStop = (node: Node): boolean => {
  if (Node.isCallExpression(node)) return /(?:^|\.)abort$|^process\.exit$/u.test(node.getExpression().getText());
  const written = assignment(node);
  return written !== undefined && STOP_FLAGS.has(written.left);
};

const runsWorkerIteration = (tryBlock: Block): boolean => {
  const writes = tryBlock.getStatements().map(assignment);
  if (writes.some(entry => entry?.left === "delay" && entry.right.getText() === "await workerIteration(state)")) return true;
  return writes.some(entry => entry?.left === "state.iteration" && entry.right.getText() === "workerIteration(state)")
    && writes.some(entry => entry?.left === "delay" && entry.right.getText() === "await state.iteration");
};

export const workerLoopStopViolations = (workerLoop: Node | undefined): readonly string[] => {
  if (!workerLoop) return ["workerLoop is missing"];
  const own = (node: Node): boolean => node.getFirstAncestor(Node.isFunctionLikeDeclaration) === workerLoop;
  const loops = workerLoop.getDescendantsOfKind(SyntaxKind.WhileStatement).filter(own);
  const loop = loops[0];
  if (loops.length !== 1 || !loop || loop.getExpression().getText() !== "!state.abort.signal.aborted") {
    return ["workerLoop must be exactly one while loop ended only by the abort signal"];
  }
  const statements = Node.isBlock(loop.getStatement()) ? loop.getStatement().asKindOrThrow(SyntaxKind.Block).getStatements() : [];
  const index = statements.findIndex(Node.isTryStatement);
  const attempt = statements[index];
  if (!Node.isTryStatement(attempt) || !attempt.getCatchClause() || statements.findIndex(isBoundedWait) <= index) {
    return ["each workerLoop pass must run a try/catch and then reach the bounded wait unconditionally"];
  }
  const violations: string[] = [];
  if (workerLoop.getDescendantsOfKind(SyntaxKind.ReturnStatement).some(own)) {
    violations.push("workerLoop returns, which ends the loop without the abort signal");
  }
  const exits = [SyntaxKind.BreakStatement, SyntaxKind.ContinueStatement]
    .flatMap(kind => workerLoop.getDescendantsOfKind(kind));
  if (exits.some(node => own(node) && targetsWorkerLoop(node, loop))) {
    violations.push("workerLoop breaks or continues its own loop, which ends it or skips the bounded wait");
  }
  const tryBlock = attempt.getTryBlock();
  if (workerLoop.getDescendantsOfKind(SyntaxKind.ThrowStatement)
    .some(node => own(node) && !node.getAncestors().includes(tryBlock))) {
    violations.push("workerLoop throws outside the try block, which escapes the loop");
  }
  if (workerLoop.getDescendants().some(node => own(node) && isRuntimeStop(node))) {
    violations.push("workerLoop aborts or stops the Runtime itself instead of leaving that to shutdown");
  }
  if (!runsWorkerIteration(tryBlock)) violations.push("the workerLoop try block must run workerIteration");
  const recovery = attempt.getCatchClause()?.getBlock().getStatements().map(assignment) ?? [];
  if (!recovery.some(entry => entry?.left === "delay" && isBoundedDelay(entry.right))) {
    violations.push(`the workerLoop catch must set a delay capped at ${BACKOFF_CEILING_MS}ms`);
  }
  return violations;
};

export const inspectWorkerLoopLiveness = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const workerLoop = sourceFor(context, RUNTIME_LOOPS)?.getVariableDeclaration("workerLoop")?.getInitializer();
  for (const message of workerLoopStopViolations(workerLoop)) {
    findings.push(createFinding({
      evidenceMode: "static.ast", lawId: LAWS.core, clauseId: `${LAWS.core.toLowerCase()}-requirement`,
      checkId: "agent-production-runtime/worker-loop-stops-on-failure", filePath: RUNTIME_LOOPS, message,
    }));
  }
  const source = sourceFor(context, RUNTIME_LOOPS);
  const iteration = source?.getVariableDeclaration("workerIteration")?.getInitializer();
  const calls = iteration?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === "reconcileCompletedBrowserTargets") ?? [];
  const cleanup = source?.getVariableDeclaration("reconcileCompletedBrowserTargets")?.getInitializer();
  const sweep = cleanup?.getDescendantsOfKind(SyntaxKind.ForOfStatement).find(node =>
    node.getExpression().getText() === "state.store.pendingBrowserCleanupJobIds()");
  const guard = sweep?.getDescendantsOfKind(SyntaxKind.IfStatement).find(node =>
    node.getExpression().getText() === "state.store.hasUnsentOutbox(jobId)"
    && node.getThenStatement().getKind() === SyntaxKind.ContinueStatement);
  const globalAdmissionRead = cleanup?.getDescendantsOfKind(SyntaxKind.CallExpression).some(node =>
    node.getExpression().getText() === "state.store.pendingBusinessAdmissions");
  if (calls.length !== 1 || !calls[0]?.getFirstAncestorByKind(SyntaxKind.TryStatement)?.getFinallyBlock()?.containsRange(
    calls[0].getStart(), calls[0].getEnd()) || !sweep || !guard || globalAdmissionRead) {
    findings.push(createFinding({ evidenceMode: "static.ast", lawId: LAWS.core,
      clauseId: `${LAWS.core.toLowerCase()}-requirement`, checkId: "agent-production-runtime/delivery-before-cleanup",
      filePath: RUNTIME_LOOPS, message: "The original finally pass must visit every pending cleanup once and guard only that job's unsent Outbox; unrelated delivery cannot veto the sweep." }));
  }
};
