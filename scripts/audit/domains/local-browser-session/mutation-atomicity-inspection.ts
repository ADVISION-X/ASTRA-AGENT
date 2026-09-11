import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, requireSource, sourcePaths } from "./inspector-support.js";

const isMethodCall = (node: MorphNode, ownerPath: string, method: string): boolean => {
  if (!Node.isCallExpression(node) || node.getArguments().length !== 0) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === method
    && astExpressionPath(expression.getExpression()) === ownerPath;
};

const exactComparisonIsStrict = (matcher: MorphNode): boolean => {
  const loop = matcher.getDescendantsOfKind(SyntaxKind.ForOfStatement).find((statement) => {
    const expression = statement.getExpression();
    return Node.isCallExpression(expression) && expression.getArguments().length === 0
      && astExpressionPath(expression.getExpression()) === "rawNodeIds.entries";
  });
  const loopBody = loop?.getStatement();
  if (!Node.isBlock(loopBody)) return false;
  const textGuard = loopBody.getStatements().find((statement) =>
    Node.isIfStatement(statement) && astIdentifierName(statement.getExpression()) === "text");
  const textBody = Node.isIfStatement(textGuard) ? textGuard.getThenStatement() : undefined;
  if (!Node.isBlock(textBody)) return false;
  const actual = textBody.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "actual")?.getInitializer();
  if (!Node.isAwaitExpression(actual)) return false;
  const nodeTextCall = actual.getExpression();
  if (!Node.isCallExpression(nodeTextCall) || astExpressionPath(nodeTextCall.getExpression()) !== "nodeText"
    || astIdentifierName(nodeTextCall.getArguments()[2]) !== "nodeId") return false;
  const matched = textBody.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "matched")?.getInitializer();
  if (!Node.isConditionalExpression(matched) || astExpressionPath(matched.getCondition()) !== "text.exact") return false;
  const exact = matched.getWhenTrue();
  const contains = matched.getWhenFalse();
  if (!Node.isBinaryExpression(exact) || exact.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken
    || !isMethodCall(exact.getLeft(), "actual", "trim") || !isMethodCall(exact.getRight(), "text.value", "trim")
    || !Node.isCallExpression(contains) || astExpressionPath(contains.getExpression()) !== "actual.includes"
    || astExpressionPath(contains.getArguments()[0]!) !== "text.value") return false;
  const mismatch = textBody.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "!matched");
  const rejection = loopBody.getStatements().find((statement) => Node.isIfStatement(statement)
    && statement.getExpression().getText() === "reasons.length > 0");
  const rejectionBody = Node.isIfStatement(rejection) ? rejection.getThenStatement() : undefined;
  return Node.isIfStatement(mismatch)
    && mismatch.getThenStatement().getText() === 'reasons.push("TEXT_MISMATCH");'
    && Node.isBlock(rejectionBody)
    && rejectionBody.getStatements().some((statement) => Node.isContinueStatement(statement));
};

export const exactTextMatcherIsStrict = (domRuntime: SourceFile): boolean => {
  const matcher = domRuntime.getVariableDeclaration("queryCandidateSet")?.getInitializer();
  return matcher !== undefined && exactComparisonIsStrict(matcher);
};

const requireTokens = (
  text: string,
  tokens: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
): void => {
  for (const token of tokens) if (!text.includes(token)) findings.push(createLocalFinding({
    checkId, lawId, filePath, message: `Disposable-attempt Browser contract is missing ${token}.`,
  }));
};

const forbidTokens = (
  text: string,
  tokens: readonly string[],
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  checkId: string,
): void => {
  for (const token of tokens) if (text.includes(token)) findings.push(createLocalFinding({
    checkId, lawId, filePath, message: `Retired Browser recovery mechanism ${token} must be physically absent.`,
  }));
};

export const inspectAtomicIfAndThenBoundary = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const store = requireSource(context, findings, lawId, "src/lib/browser/exact-target/browser-mutation-store.ts");
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  if (!store || !actor) return;
  requireTokens(store.getFullText(), ["attempt_id=?", "BROWSER_EXACT_CALL_REPLAY_FORBIDDEN", "readAtomicStepOutcome"],
    findings, lawId, store.getFilePath(), "browser-authority/current-attempt-once");
  requireTokens(actor.getFullText(), ["dispatchedForBinding", "readAtomicStepOutcome"],
    findings, lawId, sourcePaths[6], "browser-authority/current-attempt-once");
};

export const inspectDisposableAttemptBoundary = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const paths = [
    "src/lib/browser/infrastructure/browser-lane-coordinator.ts",
    "src/lib/browser/infrastructure/browser-target-acquirer.ts",
    "src/lib/browser/infrastructure/browser-authority-broker.ts",
    "src/lib/browser/exact-target/browser-mutation-store.ts",
    "src/capabilities/gpt/production-browser-lifecycle.ts",
  ];
  const sources = paths.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => !source)) return;
  const corpus = sources.map((source) => source!.getFullText()).join("\n");
  forbidTokens(corpus, ["atomicStepRecovery", "callRecoveryScope", "reconciliationScope",
    "production-reconciliation", "production-confirmed-source-readback", "confirmedProviderReadback",
    "confirmedProviderSourceReadback", "this.quarantine", "mode: \"recovery\""],
  findings, lawId, paths.join(","), "browser-authority/no-old-attempt-recovery");
  const lane = sources[0]!.getFullText();
  requireTokens(lane, ["this.queue.shift()"], findings, lawId, paths[0]!,
    "browser-authority/single-fifo");
};

export const inspectProviderEffectAttemptGuard = (
  context: InspectorContext, findings: InspectorFinding[], lawId: string,
): void => {
  const postcondition = requireSource(context, findings, lawId,
    "src/lib/browser/exact-target/browser-command-postcondition.ts");
  const store = requireSource(context, findings, lawId,
    "src/lib/browser/exact-target/browser-mutation-store.ts");
  if (!postcondition || !store) return;
  requireTokens(postcondition.getFullText(), [
    'permit.replayPolicy === "provider-effect-once" ? []',
    "permit.jobId", "payloadHash",
  ], findings, lawId, postcondition.getFilePath(),
  "browser-authority/provider-effect-cross-attempt-identity");
  const storeText = store.getFullText();
  requireTokens(storeText, [
    "where job_id=? and owner_plugin_id=?", "provider_recovery_payload",
    "consultation_identity_hash", "source_task_ref_hash", "continuation_checkpoint_hash",
    "recordContinuation", "readContinuation",
  ], findings, lawId, store.getFilePath(),
  "browser-authority/provider-effect-cross-attempt-identity");
  forbidTokens(storeText, [
    "provider_effect_identity_hash", "providerEffectIdentityHash",
    "direct_predecessor_task_ref_hash", "completed_frontier_hash",
    "persistContinuation", "advanceContinuation",
  ], findings, lawId, store.getFilePath(), "browser-authority/no-continuation-shadow-state");
};
import { Node, SyntaxKind, type Node as MorphNode, type SourceFile } from "ts-morph";
import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
