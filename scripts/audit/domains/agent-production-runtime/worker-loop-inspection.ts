import { Node, SyntaxKind } from "ts-morph";

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

/**
 * Control-flow negative guard: an ordinary iteration failure must neither end the loop, skip its bounded wait
 * nor stop the Runtime. What else a catch does (logging, metrics, diagnostics) is not frozen.
 */
export const workerLoopStopViolations = (workerLoop: Node | undefined): readonly string[] => {
  if (!workerLoop) return ["workerLoop is missing"];
  const own = (node: Node): boolean => node.getFirstAncestor((ancestor) => Node.isFunctionLikeDeclaration(ancestor)) === workerLoop;
  const loops = workerLoop.getDescendantsOfKind(SyntaxKind.WhileStatement).filter(own);
  const loop = loops[0];
  if (loops.length !== 1 || !loop || loop.getExpression().getText() !== "!state.abort.signal.aborted") {
    return ["workerLoop must be exactly one while loop ended only by the abort signal"];
  }
  const violations: string[] = [];
  const body = loop.getStatement();
  const statements = Node.isBlock(body) ? body.getStatements() : [];
  const attemptIndex = statements.findIndex((statement) => Node.isTryStatement(statement));
  const attempt = statements[attemptIndex];
  if (!Node.isTryStatement(attempt) || !attempt.getCatchClause()
    || statements.findIndex(isBoundedWait) <= attemptIndex) {
    return ["each workerLoop pass must run a try/catch and then reach the bounded wait unconditionally"];
  }
  const tryBlock = attempt.getTryBlock();
  if (workerLoop.getDescendantsOfKind(SyntaxKind.ReturnStatement).some(own)) {
    violations.push("workerLoop returns, which ends the loop without the abort signal");
  }
  const exits = [...workerLoop.getDescendantsOfKind(SyntaxKind.BreakStatement),
    ...workerLoop.getDescendantsOfKind(SyntaxKind.ContinueStatement)]
    .filter((statement) => own(statement) && targetsWorkerLoop(statement, loop));
  if (exits.length) violations.push("workerLoop breaks or continues its own loop, which ends it or skips the bounded wait");
  if (workerLoop.getDescendantsOfKind(SyntaxKind.ThrowStatement)
    .some((statement) => own(statement) && !statement.getAncestors().includes(tryBlock))) {
    violations.push("workerLoop throws outside the try block, which escapes the loop");
  }
  const stops = workerLoop.getDescendants().filter((node) => own(node) && (
    (Node.isCallExpression(node) && /(?:^|\.)abort$|^process\.exit$/u.test(node.getExpression().getText()))
    || (Node.isBinaryExpression(node) && node.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && STOP_FLAGS.has(node.getLeft().getText()))));
  if (stops.length) violations.push("workerLoop aborts or stops the Runtime itself instead of leaving that to shutdown");
  const iterated = tryBlock.getStatements().map(assignment);
  const directIteration = iterated.some(entry => entry?.left === "delay" && entry.right.getText() === "await workerIteration(state)");
  const trackedIteration = iterated.some(entry => entry?.left === "state.iteration" && entry.right.getText() === "workerIteration(state)")
    && iterated.some(entry => entry?.left === "delay" && entry.right.getText() === "await state.iteration");
  if (!directIteration && !trackedIteration) {
    violations.push("the workerLoop try block must run workerIteration");
  }
  const handler = attempt.getCatchClause()?.getBlock().getStatements().map(assignment) ?? [];
  if (!handler.some((entry) => entry?.left === "delay" && isBoundedDelay(entry.right))) {
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
  const cleanup = source?.getVariableDeclaration("reconcileCompletedBrowserTargets")?.getInitializer()?.getText() ?? "";
  if (calls.length !== 1 || !calls[0]?.getFirstAncestorByKind(SyntaxKind.TryStatement)?.getFinallyBlock()?.containsRange(
    calls[0].getStart(), calls[0].getEnd())
    || !cleanup.includes("pendingBusinessAdmissions().some(task => state.store.hasUnsentOutbox(task.task.job_id))")) {
    findings.push(createFinding({ evidenceMode: "static.ast", lawId: LAWS.core,
      clauseId: `${LAWS.core.toLowerCase()}-requirement`, checkId: "agent-production-runtime/delivery-before-cleanup",
      filePath: RUNTIME_LOOPS, message: "The original cleanup must run once after the delivery pass and recheck ready staged Outbox work before acquiring its Browser lane." }));
  }
};
