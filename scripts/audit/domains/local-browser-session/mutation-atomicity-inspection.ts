import { Node, SyntaxKind, type ClassDeclaration, type Node as MorphNode, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding } from "../../shared/inspector-contracts.js";
import { createLocalFinding, identifiers, requireIdentifiers, requireSource, sourcePaths, stringLiterals, targetAuthorityPath } from "./inspector-support.js";

type RegistryMutationSources = Readonly<Record<
  "actor" | "broker" | "commandActor" | "domRuntime" | "journal" | "manager" | "registry" | "targetAuthority",
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
  const [actor, targetAuthority, registry, commandActor, journal, manager, broker, domRuntime] = sources.map((source) => source!) as [SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile];
  return { actor, targetAuthority, registry, commandActor, journal, manager, broker, domRuntime };
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
  if (identifiers(sources.domRuntime).has("DOMParser") || actorStrings.has("Runtime.evaluate")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[19],
      message: "The MV3 executor must use the deterministic CDP node tree and cannot retain DOMParser or Runtime.evaluate.",
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
    ...identifiers(sources.journal),
    ...identifiers(sources.manager),
    ...identifiers(sources.broker),
  ]);
  for (const required of [
    "admitExtensionCommand",
    "executeRegisteredCommand",
    "BrowserProofJournal",
    "previousEntryHash",
    "entryHash",
    "PREPARED",
    "UNKNOWN",
    "BrowserArtifactRegistry",
    "registerFileArtifact",
    "issueFileArtifactGrant",
    "resolveGrantPaths",
    "resolvedFilePaths",
  ]) {
    if (!allIdentifiers.has(required) && !stringLiterals(sources.journal).includes(required)) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: sourcePaths[7],
        message: `The registry/mutation chain must contain ${required}.`,
      }));
    }
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
  const leaseContract = requireSource(
    context,
    findings,
    lawId,
    "src/lib/browser/exact-target/browser-target-lease.ts",
  );
  if (!manager || !commandActor || !domRuntime || !leaseContract) return;
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
  if (!exactTextMatcherIsStrict(domRuntime)) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[19],
    message: "The effective exact-text matcher must use normalized strict equality and cannot be replaced by substring containment or an unreachable decoy.",
  }));
  requireIdentifiers(domRuntime, ["postconditionVerified"], findings, lawId,
    "The DOM executor must retain same-command postcondition evidence.");
  requireIdentifiers(commandActor, ["postconditionVerified", "retainedValueVerified"], findings, lawId,
    "The Browser transcript must reject mutation replies that omit their declared atomic postcondition.");
};

const throwsOutcomeUnknown = (statement: Node): boolean => {
  if (Node.isBlock(statement)) {
    const statements = statement.getStatements();
    return statements.length === 1 && throwsOutcomeUnknown(statements[0]!);
  }
  if (!Node.isThrowStatement(statement)) return false;
  const expression = statement.getExpression();
  if (!Node.isNewExpression(expression)
    || astIdentifierName(expression.getExpression()) !== "Error") return false;
  const argument = expression.getArguments()[0];
  return Node.isStringLiteral(argument) && argument.getLiteralValue() === "BROWSER_OUTCOME_UNKNOWN";
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
    || !throwsOutcomeUnknown(resolveGuard.getThenStatement())
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
    && throwsOutcomeUnknown(mutationGuard.getThenStatement());
};

export const browserMutationLedgerIsAtomic = (manager: SourceFile): boolean => {
  const managerClass = manager.getClass("BrowserTargetLeaseManager");
  return managerClass !== undefined
    && resolveOneMutationGuardIsExact(managerClass)
    && newMutationGuardIsExact(managerClass);
};

const normalizedExpectedIsExact = (matcher: MorphNode): boolean => {
  const includesCall = matcher.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "includes";
    });
  const expected = matcher.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "expected")?.getInitializer();
  return !includesCall && Node.isCallExpression(expected)
    && Node.isPropertyAccessExpression(expected.getExpression())
    && astExpressionPath(expected.getExpression()) === "expectedText.trim";
};

const effectiveExactComparison = (matcher: MorphNode): MorphNode | null => {
  const loops = matcher.getDescendantsOfKind(SyntaxKind.ForOfStatement);
  if (loops.length !== 1) return null;
  const body = loops[0]!.getStatement();
  if (!Node.isBlock(body)) return null;
  const comparison = body.getStatements()[0];
  return Node.isIfStatement(comparison) ? comparison.getExpression() : null;
};

const isTrimmedObservedNodeText = (left: MorphNode): boolean => {
  if (!Node.isCallExpression(left)) return false;
  const trimExpression = left.getExpression();
  if (!Node.isPropertyAccessExpression(trimExpression)
    || trimExpression.getName() !== "trim") return false;
  const trimOwner = trimExpression.getExpression();
  if (!Node.isParenthesizedExpression(trimOwner)) return false;
  const observedText = trimOwner.getExpression();
  if (!Node.isAwaitExpression(observedText)) return false;
  const nodeTextCall = observedText.getExpression();
  return Node.isCallExpression(nodeTextCall)
    && astExpressionPath(nodeTextCall.getExpression()) === "nodeText"
    && astIdentifierName(nodeTextCall.getArguments()[2]) === "nodeId";
};

const exactComparisonIsStrict = (matcher: MorphNode): boolean => {
  const condition = effectiveExactComparison(matcher);
  return condition !== null && Node.isBinaryExpression(condition)
    && condition.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && astIdentifierName(condition.getRight()) === "expected"
    && isTrimmedObservedNodeText(condition.getLeft());
};

export const exactTextMatcherIsStrict = (domRuntime: SourceFile): boolean => {
  const matcher = domRuntime.getVariableDeclaration("nodesWithExactText")?.getInitializer();
  return matcher !== undefined
    && normalizedExpectedIsExact(matcher)
    && exactComparisonIsStrict(matcher);
};

const recoveryGenesisExcludesCurrentIdentity = (journal: SourceFile): boolean => {
  const event = journal.getTypeAlias("BrowserProofRecoveryEvent")
    ?.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
  const keys = journal.getVariableDeclaration("recoveryKeys")?.getInitializer();
  if (!Node.isTypeLiteral(event) || !Node.isArrayLiteralExpression(keys)) return false;
  const eventProperties = new Set(event.getProperties().flatMap((property) =>
    Node.isPropertySignature(property) ? [property.getName()] : []));
  const keyValues = new Set(keys.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralValue()] : []));
  const currentIdentity = ["candidateHash", "extensionId", "releaseBuildId"];
  const historicalIdentity = ["observedCandidateHashes", "observedReleaseBuildIds"];
  return currentIdentity.every((name) => !eventProperties.has(name) && !keyValues.has(name))
    && historicalIdentity.every((name) => eventProperties.has(name) && keyValues.has(name));
};

export const inspectJournalRecoveryBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const recovery = requireSource(context, findings, lawId, sourcePaths[25]);
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
  if (!recovery || !journal) return;
  requireIdentifiers(recovery, [
    "recoverBrowserProofJournal", "assertExclusiveOwner", "ensureExactSealedFile",
    "originalJournalSha256", "firstInvalidLine", "recoveryReceiptPath", "renameSync",
    "fsyncSync",
  ], findings, lawId, "Journal recovery must be explicit, exclusive, sealed, hash-bound, receipted and atomically committed.");
  requireIdentifiers(journal, [
    "BrowserProofRecoveryEvent", "createBrowserRecoveryEnvelope", "recoveryCount",
  ], findings, lawId, "The V2 canonical journal must admit exactly one typed recovery genesis.");
  if (!recoveryGenesisExcludesCurrentIdentity(journal)) findings.push(createLocalFinding({
    checkId: "browser-authority/recovery-identity-boundary",
    lawId,
    filePath: sourcePaths[7],
    message: "Recovery genesis may record sealed historical identity observations, but must not carry current candidate, extension, or release identity.",
  }));
  for (const literal of [
    "grasseye.browser-proof-journal.v2",
    "RECOVERY",
    "GENESIS",
    "BROWSER_JOURNAL_RECOVERY_NOT_AUTHORIZED",
    "BROWSER_JOURNAL_RECOVERY_SOURCE_DRIFT",
    "BROWSER_JOURNAL_RECOVERY_RECEIPT_CONFLICT",
  ]) {
    if ([...stringLiterals(recovery), ...stringLiterals(journal)].includes(literal)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[25],
      message: `The journal recovery boundary must retain ${literal}.`,
    }));
  }
};
