import { Node, SyntaxKind, type ClassDeclaration, type Node as MorphNode, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource, sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

type RegistryMutationSources = Readonly<Record<
  "actor" | "broker" | "commandActor" | "domRuntime" | "manager" | "mutationStore" | "registry" | "targetAuthority",
  SourceFile
>>;

const requireRegistryMutationSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RegistryMutationSources | null => {
  const paths = [sourcePaths[1], targetAuthorityPath, sourcePaths[8], sourcePaths[6], sourcePaths[7], sourcePaths[5], sourcePaths[18], sourcePaths[19]];
  const sources = paths.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => source === null)) return null;
  const [actor, targetAuthority, registry, commandActor, mutationStore, manager, broker, domRuntime] = sources.map((source) => source!) as [SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile];
  return { actor, targetAuthority, registry, commandActor, mutationStore, manager, broker, domRuntime };
};
const inspectExtensionExecutionBoundary = (
  sources: RegistryMutationSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorStrings = new Set([...stringLiterals(sources.actor), ...stringLiterals(sources.targetAuthority)]);
  if (!actorStrings.has("DOM.setFileInputFiles") || !actorStrings.has("#upload-files")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[1],
      message: "The extension file-input command must use one observed #upload-files target and DOM.setFileInputFiles.",
    }));
  }
  if (identifiers(sources.domRuntime).has("DOMParser")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[19],
      message: "The DOM intent executor must use the deterministic CDP node tree and cannot retain DOMParser.",
    }));
  }
  const forbiddenExecutors = new Set(["eval", "Function", "executeScript"]);
  const forbidden = sources.actor.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    const name = Node.isIdentifier(expression) ? astIdentifierName(expression) : undefined;
    return name !== undefined && forbiddenExecutors.has(name);
  });
  if (forbidden) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[1],
    line: forbidden.getStartLineNumber(),
    message: "The fixed extension command actor must not execute arbitrary code.",
  }));
};

export const inspectRegistryAndMutationBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = requireRegistryMutationSources(context, findings, lawId);
  if (!sources) return;
  const allIdentifiers = new Set([
    ...identifiers(sources.actor),
    ...identifiers(sources.targetAuthority),
    ...identifiers(sources.registry),
    ...identifiers(sources.commandActor),
    ...identifiers(sources.mutationStore),
    ...identifiers(sources.manager),
    ...identifiers(sources.broker),
  ]);
  const mutationLiterals = stringLiterals(sources.mutationStore);
  for (const required of [
    "admitExtensionCommand",
    "executeRegisteredCommand",
    "BrowserMutationStore",
    "requestHash",
    "payloadHash",
    "proofHash",
    "exactCallIdentityHash",
    "pluginVersion",
    "terminalAt",
    "readExactCallMutationFact",
    "logicalMutationId",
    "productStepId",
    "callId",
    "childCapabilityId",
    "inputHash",
    "effectScope",
    "actionOrdinal",
    "positivePostconditionHash",
    "negativePostconditionHash",
    "PREPARED",
    "DISPATCHED",
    "REJECTED",
    "BrowserArtifactRegistry",
    "registerFileArtifact",
    "issueFileArtifactGrant",
    "resolveGrantPaths",
    "resolvedFilePaths",
  ]) {
    if (!allIdentifiers.has(required) && !mutationLiterals.includes(required)) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: sourcePaths[7],
        message: `The registry/mutation chain must contain ${required}.`,
      }));
    }
  }
  const retiredIdentifiers = ["markSent", "markUnknown", "unknownForBinding", "readUnknown"];
  const retiredLiterals = ["SENT", "UNKNOWN", "BROWSER_OUTCOME_UNKNOWN"];
  for (const retired of [...retiredIdentifiers.filter((name) => allIdentifiers.has(name)),
    ...retiredLiterals.filter((value) => mutationLiterals.includes(value))]) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/retired-mutation-chain",
      lawId,
      filePath: sourcePaths[7],
      message: `The retired Browser mutation token ${retired} must be physically absent.`,
    }));
  }
  inspectExtensionExecutionBoundary(sources, findings, lawId);
};

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
  if (!manager || !commandActor || !domRuntime || !domQueryRuntime || !leaseContract) return;
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
  requireIdentifiers(domRuntime, ["postconditionVerified"], findings, lawId,
    "The DOM executor must retain same-command postcondition evidence.");
  requireIdentifiers(commandActor, ["postconditionVerified", "retainedValueVerified"], findings, lawId,
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
  const createMethod = managerClass?.getMethod("createLeaseCommand");
  const createBody = createMethod?.getBody();
  const returnStatement = Node.isBlock(createBody)
    ? createBody.getStatements().find(Node.isReturnStatement) : undefined;
  const worker = returnStatement?.getExpression();
  if (!Node.isArrowFunction(worker)) return false;
  const workerBody = worker.getBody();
  if (!Node.isBlock(workerBody)) return false;
  const mutationGuard = workerBody.getStatements()[1];
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

const isTrimCall = (node: MorphNode, ownerName: string): boolean => {
  if (!Node.isCallExpression(node) || node.getArguments().length !== 0) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getName() === "trim"
    && astIdentifierName(expression.getExpression()) === ownerName;
};

const normalizedExpectedIsExact = (matcher: MorphNode): boolean => {
  const expected = matcher.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "expected")?.getInitializer();
  return Node.isConditionalExpression(expected)
    && astIdentifierName(expected.getCondition()) === "exact"
    && isTrimCall(expected.getWhenTrue(), "expectedText")
    && astIdentifierName(expected.getWhenFalse()) === "expectedText";
};

const exactComparisonIsStrict = (matcher: MorphNode): boolean => {
  const loops = matcher.getDescendantsOfKind(SyntaxKind.ForOfStatement);
  if (loops.length !== 1) return false;
  const body = loops[0]!.getStatement();
  if (!Node.isBlock(body)) return false;
  const [actualStatement, comparison] = body.getStatements();
  if (!Node.isVariableStatement(actualStatement) || !Node.isIfStatement(comparison)
    || !Node.isContinueStatement(comparison.getThenStatement())) return false;
  const actual = actualStatement.getDeclarations()[0];
  const observed = actual?.getInitializer();
  if (actual?.getName() !== "actual" || !Node.isAwaitExpression(observed)) return false;
  const nodeTextCall = observed.getExpression();
  if (!Node.isCallExpression(nodeTextCall)
    || astExpressionPath(nodeTextCall.getExpression()) !== "nodeText"
    || astIdentifierName(nodeTextCall.getArguments()[2]) !== "nodeId") return false;
  const condition = comparison.getExpression();
  if (!Node.isConditionalExpression(condition)
    || astIdentifierName(condition.getCondition()) !== "exact") return false;
  const exactMismatch = condition.getWhenTrue();
  return Node.isBinaryExpression(exactMismatch)
    && exactMismatch.getOperatorToken().getKind() === SyntaxKind.ExclamationEqualsEqualsToken
    && isTrimCall(exactMismatch.getLeft(), "actual")
    && astIdentifierName(exactMismatch.getRight()) === "expected";
};

export const exactTextMatcherIsStrict = (domRuntime: SourceFile): boolean => {
  const matcher = domRuntime.getVariableDeclaration("queryVisibleTextMatches")?.getInitializer();
  return matcher !== undefined
    && normalizedExpectedIsExact(matcher)
    && exactComparisonIsStrict(matcher);
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
    "markRejected", "markFailedBeforeDispatch", "resolve", "dispatchedForBinding", "dispatchedForJob",
    "reconciliationScope", "callRecoveryScope", "atomicStepRecovery", "readDispatched",
    "logicalMutationId", "exactCallIdentityHash", "pluginVersion", "productStepId", "callId", "childCapabilityId", "inputHash", "effectScope",
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

export const inspectJobScopedMutationRecovery = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const lanePath = "src/lib/browser/infrastructure/browser-lane-coordinator.ts";
  const lane = requireSource(context, findings, lawId, lanePath);
  const actor = requireSource(context, findings, lawId, sourcePaths[6]);
  if (!lane || !actor) return;
  requireIdentifiers(lane, ["callRecoveryScope", "recovery", "park", "pump"], findings, lawId,
    "Browser recovery must be job-scoped, exact-target and capacity releasing.");
  const laneText = lane.getFullText();
  for (const retired of ["private unsettled", "acquireReconciliation", "reconciliationAllowed"]) {
    if (!laneText.includes(retired)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/job-scoped-recovery",
      lawId,
      filePath: lanePath,
      message: `The retired global Browser recovery gate ${retired} must be physically absent.`,
    }));
  }
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
