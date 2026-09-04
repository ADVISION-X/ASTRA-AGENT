import { Node, SyntaxKind, type ClassDeclaration, type Node as MorphNode, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource,
  sourcePaths, stringLiterals } from "./inspector-support.js";

export const inspectAtomicIfAndThenBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const manager = requireSource(context, findings, lawId, sourcePaths[5]);
  const commandActor = requireSource(context, findings, lawId, sourcePaths[6]);
  const domRuntime = requireSource(context, findings, lawId, sourcePaths[19]);
  const domQueryRuntime = requireSource(
    context,
    findings,
    lawId,
    "src/lib/browser/chrome-extension/dom-query-runtime.ts",
  );
  const leaseContract = requireSource(
    context,
    findings,
    lawId,
    "src/lib/browser/exact-target/browser-target-lease.ts",
  );
  const mutationReceipt = requireSource(
    context, findings, lawId, "src/lib/browser/exact-target/browser-mutation-receipt.ts",
  );
  if (!manager || !commandActor || !domRuntime || !domQueryRuntime || !leaseContract
    || !mutationReceipt) return;
  const contractIdentifiers = identifiers(leaseContract);
  if (!browserMutationLedgerIsAtomic(manager)
    || !contractIdentifiers.has("resolvePendingMutation")
    || contractIdentifiers.has("resolvePendingMutations")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[5],
      message: "Browser mutation orchestration must enforce IF current exact state AND one terminal receipt THEN resolve exactly one mutation; a second mutation and batch drain must remain impossible.",
    }));
  }
  if (!exactTextMatcherIsStrict(domQueryRuntime)) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: "src/lib/browser/chrome-extension/dom-query-runtime.ts",
    message: "The effective exact-text matcher must use normalized strict equality and cannot be replaced by substring containment or an unreachable decoy.",
  }));
  const domFailureText = `${domRuntime.getFullText()}\n${domQueryRuntime.getFullText()}`;
  for (const code of [
    "BROWSER_DOM_CANDIDATE_MISSING",
    "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
    "BROWSER_DOM_ACTION_NOT_QUALIFIED",
    "BROWSER_DOM_NODE_STALE",
    "BROWSER_DOM_READ_INVALID",
  ]) if (!domFailureText.includes(code)) findings.push(createLocalFinding({
    checkId: "browser-authority/dom-failure-classification",
    lawId,
    filePath: "src/lib/browser/chrome-extension/dom-query-runtime.ts",
    message: `Browser DOM observations must preserve the exact ${code} cause.`,
  }));
  if (domFailureText.includes('throw new Error("BROWSER_TARGET_INVALID")')) findings.push(createLocalFinding({
    checkId: "browser-authority/dom-failure-classification",
    lawId,
    filePath: "src/lib/browser/chrome-extension/dom-query-runtime.ts",
    message: "DOM candidate, node and payload failures must not be collapsed into BROWSER_TARGET_INVALID.",
  }));
  requireIdentifiers(domRuntime, ["postconditionVerified"], findings, lawId,
    "The DOM executor must retain same-command postcondition evidence.");
  requireIdentifiers(mutationReceipt, ["postconditionVerified", "retainedValueVerified"], findings, lawId,
    "The Browser transcript must reject mutation replies that omit their declared atomic postcondition.");
};

const throwsMutationUnsettled = (statement: Node): boolean => {
  if (Node.isBlock(statement)) {
    const statements = statement.getStatements();
    return statements.length === 1 && throwsMutationUnsettled(statements[0]!);
  }
  if (!Node.isThrowStatement(statement)) return false;
  const expression = statement.getExpression();
  if (!Node.isNewExpression(expression)
    || astIdentifierName(expression.getExpression()) !== "Error") return false;
  const argument = expression.getArguments()[0];
  return Node.isStringLiteral(argument) && argument.getLiteralValue() === "BROWSER_MUTATION_UNSETTLED";
};

const isNumericComparison = (
  node: Node,
  path: string,
  operator: SyntaxKind,
  value: number,
): boolean => Node.isBinaryExpression(node)
  && astExpressionPath(node.getLeft()) === path
  && node.getOperatorToken().getKind() === operator
  && (() => {
    const right = node.getRight();
    return Node.isNumericLiteral(right) && right.getLiteralValue() === value;
  })();

const isUndefinedComparison = (node: Node, path: string): boolean =>
  Node.isBinaryExpression(node)
  && astExpressionPath(node.getLeft()) === path
  && node.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
  && astIdentifierName(node.getRight()) === "undefined";

const isMutationClassification = (node: Node): boolean => {
  if (!Node.isBinaryExpression(node)) return false;
  const right = node.getRight();
  if (node.getOperatorToken().getKind() !== SyntaxKind.EqualsEqualsEqualsToken
    || !Node.isStringLiteral(right)
    || right.getLiteralValue() !== "mutation") return false;
  const call = node.getLeft();
  return Node.isCallExpression(call)
    && astExpressionPath(call.getExpression()) === "this.mutationClass"
    && astIdentifierName(call.getArguments()[0]) === "value";
};

const resolveOneMutationGuardIsExact = (managerClass: ClassDeclaration): boolean => {
  const resolveMethod = managerClass?.getMethod("resolvePendingMutation");
  const resolveBody = resolveMethod?.getBody();
  const resolveStatements = Node.isBlock(resolveBody) ? resolveBody.getStatements() : [];
  const resolveGuard = resolveStatements[2];
  if (!Node.isIfStatement(resolveGuard)) return false;
  const resolveCondition = resolveGuard.getExpression();
  if (!Node.isBinaryExpression(resolveCondition)
    || resolveCondition.getOperatorToken().getKind() !== SyntaxKind.BarBarToken
    || !isNumericComparison(resolveCondition.getLeft(), "commandIds.length", SyntaxKind.ExclamationEqualsEqualsToken, 1)
    || !isUndefinedComparison(resolveCondition.getRight(), "commandId")
    || !throwsMutationUnsettled(resolveGuard.getThenStatement())
    || (resolveMethod?.getDescendantsOfKind(SyntaxKind.ForOfStatement).length ?? 0) > 0
    || (resolveMethod?.getDescendantsOfKind(SyntaxKind.ForStatement).length ?? 0) > 0) return false;
  return true;
};

const newMutationGuardIsExact = (managerClass: ClassDeclaration): boolean => {
  const admissionMethod = managerClass.getMethod("assertCommandAdmission");
  const admissionBody = admissionMethod?.getBody();
  if (!Node.isBlock(admissionBody)) return false;
  const mutationGuard = admissionBody.getStatements().find((statement): statement is import("ts-morph").IfStatement =>
    Node.isIfStatement(statement)
    && statement.getExpression().getText().includes("state.pendingMutationCommandIds.length"));
  if (!Node.isIfStatement(mutationGuard)) return false;
  const mutationCondition = mutationGuard.getExpression();
  return Node.isBinaryExpression(mutationCondition)
    && mutationCondition.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken
    && isMutationClassification(mutationCondition.getLeft())
    && isNumericComparison(
      mutationCondition.getRight(),
      "state.pendingMutationCommandIds.length",
      SyntaxKind.GreaterThanToken,
      0,
    )
    && throwsMutationUnsettled(mutationGuard.getThenStatement());
};

export const browserMutationLedgerIsAtomic = (manager: SourceFile): boolean => {
  const managerClass = manager.getClass("BrowserTargetLeaseManager");
  return managerClass !== undefined
    && resolveOneMutationGuardIsExact(managerClass)
    && newMutationGuardIsExact(managerClass);
};

const isMethodCall = (node: MorphNode, ownerPath: string, method: string): boolean => {
  if (!Node.isCallExpression(node) || node.getArguments().length !== 0) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === method
    && astExpressionPath(expression.getExpression()) === ownerPath;
};

const matchedComparisonIsStrict = (matched: MorphNode | undefined): boolean => {
  if (!Node.isConditionalExpression(matched) || astExpressionPath(matched.getCondition()) !== "text.exact") return false;
  const exactMatch = matched.getWhenTrue();
  const containsMatch = matched.getWhenFalse();
  return Node.isBinaryExpression(exactMatch)
    && exactMatch.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && isMethodCall(exactMatch.getLeft(), "actual", "trim")
    && isMethodCall(exactMatch.getRight(), "text.value", "trim")
    && Node.isCallExpression(containsMatch)
    && astExpressionPath(containsMatch.getExpression()) === "actual.includes"
    && astExpressionPath(containsMatch.getArguments()[0]!) === "text.value";
};

const exactComparisonIsStrict = (matcher: MorphNode): boolean => {
  const loop = matcher.getDescendantsOfKind(SyntaxKind.ForOfStatement)
    .find((statement) => {
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
  if (!Node.isCallExpression(nodeTextCall)
    || astExpressionPath(nodeTextCall.getExpression()) !== "nodeText"
    || astIdentifierName(nodeTextCall.getArguments()[2]) !== "nodeId") return false;
  const matched = textBody.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "matched")?.getInitializer();
  if (!matchedComparisonIsStrict(matched)) return false;
  const mismatchGuard = textBody.getStatements().find((statement) =>
    Node.isIfStatement(statement) && statement.getExpression().getText() === "!matched");
  if (!Node.isIfStatement(mismatchGuard)
    || mismatchGuard.getThenStatement().getText() !== 'reasons.push("TEXT_MISMATCH");') return false;
  const rejectionGuard = loopBody.getStatements().find((statement) =>
    Node.isIfStatement(statement) && statement.getExpression().getText() === "reasons.length > 0");
  const rejectionBody = Node.isIfStatement(rejectionGuard) ? rejectionGuard.getThenStatement() : undefined;
  return Node.isBlock(rejectionBody)
    && rejectionBody.getStatements().some((statement) => Node.isContinueStatement(statement));
};

export const exactTextMatcherIsStrict = (domRuntime: SourceFile): boolean => {
  const matcher = domRuntime.getVariableDeclaration("queryCandidateSet")?.getInitializer();
  return matcher !== undefined && exactComparisonIsStrict(matcher);
};

export const inspectCompactMutationRecoveryBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const mutationStore = requireSource(context, findings, lawId, sourcePaths[7]);
  if (!mutationStore) return;
  requireIdentifiers(mutationStore, [
    "BrowserMutationStore", "prepare", "markDispatched", "markReceiptMissing", "markConfirmed",
    "markRejected", "markFailedBeforeDispatch", "markTargetLocalDocumentAbsent", "resolve", "dispatchedForBinding", "dispatchedForJob",
    "reconciliationScope", "callRecoveryScope", "atomicStepRecovery", "readDispatched",
    "logicalMutationId", "exactCallIdentityHash", "pluginVersion", "productStepId", "callId", "childCapabilityId", "requestHash", "effectScope",
    "actionOrdinal", "positivePostconditionHash", "negativePostconditionHash", "requestHash", "payloadHash",
    "proofHash", "terminalAt", "readExactCallMutationFact",
  ], findings, lawId, "Compact Browser mutation recovery must remain one SQLite/WAL row per physical mutation and exact job binding.");
  const literals = new Set(stringLiterals(mutationStore));
  for (const literal of [
    "browser-mutations.sqlite",
    "journal_mode = WAL",
    "PREPARED",
    "DISPATCHED",
    "CONFIRMED",
    "REJECTED",
    "FAILED",
    "BROWSER_COMMAND_RECEIPT_MISSING",
    "BROWSER_COMMAND_NOT_DISPATCHED",
    "BROWSER_LOGICAL_MUTATION_REPLAY_FORBIDDEN",
  ]) {
    if ([...literals].some((value) => value.includes(literal))) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[7],
      message: `The compact mutation recovery boundary must retain ${literal}.`,
    }));
  }
  for (const retired of ["SENT", "UNKNOWN", "BROWSER_OUTCOME_UNKNOWN"]) if (literals.has(retired)) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/retired-mutation-chain",
      lawId,
      filePath: sourcePaths[7],
      message: `The retired compact mutation state ${retired} must be physically absent.`,
    }));
  }
};

const inspectLaneRecoveryContract = (
  lane: SourceFile,
  lanePath: string,
  targetAcquirer: SourceFile,
  targetAcquirerPath: string,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  requireIdentifiers(lane, ["callRecoveryScope", "recovery", "park", "pump", "quarantine",
    "refreshQuarantine", "rejectLostTargetLocalDocument", "settleLostTargetLocalDocument",
    "observeCurrentTargetClaim"], findings, lawId,
  "Browser recovery must be job-scoped, exact-target and quarantine the sole Browser lane.");
  const laneText = lane.getFullText();
  for (const required of [
    "confirmedReadbackMatches",
    "confirmedProviderTargetReplaced",
    "recoveryMutationOutcome",
    'this.quarantine ? "blocked" : "idle"',
    "this.bindingMatchesRecovery",
    "markTargetLocalDocumentAbsent",
  ]) {
    if (laneText.includes(required)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/confirmed-provider-target-replacement",
      lawId,
      filePath: lanePath,
      message: `Confirmed Provider readback recovery must retain ${required}.`,
    }));
  }
  const targetAcquirerText = targetAcquirer.getFullText();
  for (const required of [
    'recovery?.state === "CONFIRMED"', 'recovery.effectScope === "provider_effect"',
    'error.message === "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT"',
  ]) if (!targetAcquirerText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/confirmed-provider-target-replacement",
    lawId,
    filePath: targetAcquirerPath,
    message: `The target acquirer must retain ${required}.`,
  }));
  for (const retired of ["private unsettled", "acquireReconciliation", "reconciliationAllowed"]) {
    if (!laneText.includes(retired)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/job-scoped-recovery",
      lawId,
      filePath: lanePath,
      message: `The retired global Browser recovery gate ${retired} must be physically absent.`,
    }));
  }
};

const inspectActorEffectScope = (
  actor: SourceFile,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorText = actor.getFullText();
  for (const required of [
    "provider_effect", "target_local", 'effectScope === "target_local" ? [permit.targetRef] : []',
    "exactCallIdentityHash", "pluginVersion",
  ]) {
    if (actorText.includes(required)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/logical-effect-scope",
      lawId,
      filePath: sourcePaths[6],
      message: `Browser logical mutation identity is missing ${required}.`,
    }));
  }
};

export const inspectJobScopedMutationRecovery = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const lanePath = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
  const targetAcquirerPath = "src/lib/browser/infrastructure/browser-target-acquirer.ts";
  const lane = requireSource(context, findings, lawId, lanePath);
  const targetAcquirer = requireSource(context, findings, lawId, targetAcquirerPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  if (!lane || !targetAcquirer || !actor) return;
  inspectLaneRecoveryContract(lane, lanePath, targetAcquirer, targetAcquirerPath, findings, lawId);
  inspectActorEffectScope(actor, findings, lawId);
};
