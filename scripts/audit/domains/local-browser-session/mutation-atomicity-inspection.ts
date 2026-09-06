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
  requireIdentifiers(domRuntime, ["postconditionVerified", "targetTransitionPostcondition"], findings, lawId,
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

export const inspectProviderEffectCrossAttemptGuard = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const postcondition = requireSource(context, findings, lawId,
    "src/lib/browser/exact-target/browser-command-postcondition.ts");
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  const store = requireSource(context, findings, lawId, sourcePaths[7]);
  if (!postcondition || !actor || !store) return;
  const identity = postcondition.getVariableDeclaration("browserProviderEffectIdentityHash");
  const identityText = identity?.getInitializer()?.getText() ?? "";
  const orderedFields = [
    "permit.jobId", "permit.ownerPluginId", "permit.pluginVersion", "permit.productStepId",
    "permit.callId", "permit.childCapabilityId", "permit.inputHash", "payloadHash",
  ];
  let cursor = -1;
  const ordered = orderedFields.every((field) => {
    const next = identityText.indexOf(field, cursor + 1);
    if (next < 0) return false;
    cursor = next;
    return true;
  });
  if (!identity || !ordered || identityText.includes("attemptId") || identityText.includes("targetRef")
    || identityText.includes("documentRef") || identityText.includes("leaseVersion")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/provider-effect-identity",
      lawId,
      filePath: "src/lib/browser/exact-target/browser-command-postcondition.ts",
      message: "Provider effect identity must hash only the ordered job/plugin/version/step/call/child/request/payload tuple.",
    }));
  }
  const actorText = actor.getFullText();
  if (!actorText.includes("browserProviderEffectIdentityHash(permit, payloadHash)")
    || !actorText.includes('effectScope === "provider_effect"')) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/provider-effect-identity",
      lawId,
      filePath: sourcePaths[6],
      message: "The Browser command actor must consume the canonical provider-effect identity before WAL admission.",
    }));
  }
  const guard = store.getClass("BrowserMutationStore")?.getMethod("assertProviderEffectHistory");
  const guardText = guard?.getFullText() ?? "";
  for (const required of [
    "logical_mutation_id", "owner_plugin_id", "plugin_version", "job_id", "attempt_id",
    "product_step_id", "call_id", "child_capability_id", "effect_scope", "request_hash",
    "payload_hash", "PREPARED", "DISPATCHED", "CONFIRMED", "REJECTED",
    "BROWSER_PROVIDER_EFFECT_HISTORY_AMBIGUOUS", "BROWSER_PROVIDER_EFFECT_REPLAY_FORBIDDEN",
    'row.state !== "REJECTED"', 'row.mutation_outcome !== "no"', "attempts.has(input.attemptId)",
  ]) if (!guardText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/provider-effect-predispatch",
    lawId,
    filePath: sourcePaths[7],
    message: `The Browser WAL cross-attempt provider-effect guard is missing ${required}.`,
  }));
  const prepare = store.getClass("BrowserMutationStore")?.getMethod("prepare")?.getFullText() ?? "";
  if (prepare.indexOf("assertProviderEffectHistory(input)") < 0
    || prepare.indexOf("assertProviderEffectHistory(input)") > prepare.indexOf("insert into browser_mutations")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/provider-effect-predispatch",
      lawId,
      filePath: sourcePaths[7],
      message: "Provider-effect history must be proved before the PREPARED row is inserted.",
    }));
  }
};

const inspectConfirmedReadbackFiles = (input: Readonly<{
  readbackSource: SourceFile;
  readbackSourcePath: string;
  readbackLease: SourceFile;
  readbackLeasePath: string;
  findings: InspectorFinding[];
  lawId: string;
}>): void => {
  const { readbackSource, readbackSourcePath, readbackLease, readbackLeasePath,
    findings, lawId } = input;
  const sourceText = readbackSource.getFullText();
  for (const required of [
    "confirmedSourceMatches", 'kind === "production-confirmed-source-readback"',
    'source.sourceChildCapabilityId === "submit_exact_gpt_turn_once"',
  ]) if (!sourceText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/confirmed-provider-target-replacement",
    lawId,
    filePath: readbackSourcePath,
    message: `Confirmed Provider source validation must retain ${required}.`,
  }));
  const leaseText = readbackLease.getFullText();
  for (const required of [
    "readOnlyLease", "CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN",
    '"focus_exact_gpt_conversation"', '"wait_for_stable_gpt_text"',
    '"wait_for_stable_gpt_image"', "downloadAuthenticatedMedia: reject",
  ]) if (!leaseText.includes(required)) findings.push(createLocalFinding({
    checkId: "browser-authority/confirmed-provider-target-replacement",
    lawId,
    filePath: readbackLeasePath,
    message: `Confirmed Provider readback lease admission must retain ${required}.`,
  }));
};

const inspectLaneRecoveryContract = (input: Readonly<{
  lane: SourceFile;
  lanePath: string;
  readbackSource: SourceFile;
  readbackSourcePath: string;
  readbackLease: SourceFile;
  readbackLeasePath: string;
  targetAcquirer: SourceFile;
  targetAcquirerPath: string;
  findings: InspectorFinding[];
  lawId: string;
}>): void => {
  const { lane, lanePath, readbackSource, readbackSourcePath, readbackLease,
    readbackLeasePath, targetAcquirer, targetAcquirerPath, findings, lawId } = input;
  requireIdentifiers(lane, ["callRecoveryScope", "recovery", "park", "pump", "quarantine",
    "refreshQuarantine", "rejectLostTargetLocalDocument", "settleLostTargetLocalDocument",
    "observeCurrentTargetClaim"], findings, lawId,
  "Browser recovery must be job-scoped, exact-target and quarantine the sole Browser lane.");
  const laneText = lane.getFullText();
  for (const required of [
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
  inspectConfirmedReadbackFiles({
    readbackSource, readbackSourcePath, readbackLease, readbackLeasePath, findings, lawId,
  });
  const targetAcquirerText = targetAcquirer.getFullText();
  for (const required of [
    'recovery?.state === "CONFIRMED"', 'recovery.effectScope === "provider_effect"',
    'error.message === "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT"',
    'waiter.binding.kind === "production-reconciliation"',
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
    "provider_effect", "target_local", ": hashValue([callIdentityHash, permit.targetRef])",
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
  const readbackSourcePath = "src/lib/browser/infrastructure/browser-confirmed-readback-source.ts";
  const readbackLeasePath = "src/lib/browser/infrastructure/browser-confirmed-readback-lease.ts";
  const targetAcquirerPath = "src/lib/browser/infrastructure/browser-target-acquirer.ts";
  const lane = requireSource(context, findings, lawId, lanePath);
  const readbackSource = requireSource(context, findings, lawId, readbackSourcePath);
  const readbackLease = requireSource(context, findings, lawId, readbackLeasePath);
  const targetAcquirer = requireSource(context, findings, lawId, targetAcquirerPath);
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  if (!lane || !readbackSource || !readbackLease || !targetAcquirer || !actor) return;
  inspectLaneRecoveryContract({
    lane, lanePath, readbackSource, readbackSourcePath, readbackLease, readbackLeasePath,
    targetAcquirer, targetAcquirerPath, findings, lawId,
  });
  inspectActorEffectScope(actor, findings, lawId);
};
