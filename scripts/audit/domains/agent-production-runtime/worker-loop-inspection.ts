import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { LAWS, sourceFor } from "./contract-inspection.js";

const RUNTIME_LOOPS = "src/lib/local-runtime/production/runtime-loops.ts";
const BACKOFF_CEILING_MS = 30_000;
const CATCH_MAY_ASSIGN = new Set(["state.lastErrorCode", "state.lastErrorReason", "delay"]);
const LOOP_EXITS = [SyntaxKind.ReturnStatement, SyntaxKind.BreakStatement,
  SyntaxKind.ContinueStatement, SyntaxKind.ThrowStatement] as const;

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

/** An ordinary iteration failure only records the error and waits a bounded time; solely the abort signal may end the loop. */
export const workerLoopStopViolations = (workerLoop: Node | undefined): readonly string[] => {
  if (!workerLoop) return ["workerLoop is missing"];
  const violations: string[] = [];
  if (LOOP_EXITS.some((kind) => workerLoop.getDescendantsOfKind(kind).length > 0)) {
    violations.push("workerLoop contains a return, break, continue or throw that can end or skip its bounded wait");
  }
  const loops = workerLoop.getDescendantsOfKind(SyntaxKind.WhileStatement);
  const loop = loops[0];
  if (loops.length !== 1 || !loop || loop.getExpression().getText() !== "!state.abort.signal.aborted") {
    return [...violations, "workerLoop must be exactly one while loop ended only by the abort signal"];
  }
  const body = loop.getStatement();
  const [attempt, waited, ...rest] = Node.isBlock(body) ? body.getStatements() : [];
  if (!Node.isTryStatement(attempt) || !isBoundedWait(waited) || rest.length > 0) {
    return [...violations, "each workerLoop pass must be one try/catch followed by the bounded wait"];
  }
  const iterated = attempt.getTryBlock().getStatements().map(assignment);
  if (!iterated.some((entry) => entry?.left === "delay" && entry.right.getText() === "await workerIteration(state)")) {
    violations.push("the workerLoop try block must run workerIteration");
  }
  const handler = attempt.getCatchClause()?.getBlock().getStatements() ?? [];
  const recorded = handler.map(assignment);
  if (attempt.getFinallyBlock() || !handler.length
    || recorded.some((entry) => entry === undefined || !CATCH_MAY_ASSIGN.has(entry.left))) {
    violations.push("the workerLoop catch may only record the error and set the next delay");
  }
  if (!recorded.some((entry) => entry?.left === "delay" && isBoundedDelay(entry.right))) {
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
};
