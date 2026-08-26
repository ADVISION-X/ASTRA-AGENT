import { Node, Project, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const paths = {
  checkpoint: "src/capabilities/ai-input-gateway/runtime/web-chat-response-checkpoint.ts",
  checkpointResponse: "src/capabilities/ai-input-gateway/providers/web-chat-checkpoint-response.ts",
  executionState: "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  managed: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  feedProviderOnce: "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  failureClassification: "src/capabilities/ai-input-gateway/failure-classification.ts",
  rateGuard: "src/capabilities/ai-input-gateway/runtime/ai-feed-rate-guard.ts",
  identityAcceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-identity-recovery.acceptance-helper.ts",
  recoveryAcceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-recovery.acceptance-helper.ts",
  shared: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  sessionController: "src/capabilities/ai-input-gateway/providers/web-chat-session-controller.ts",
  conversationTitle: "src/capabilities/ai-input-gateway/providers/gpt-web-conversation-title.ts",
  submit: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  singleTabBrowser: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  canonicalBinding: "src/capabilities/ai-input-gateway/runtime/web-chat-canonical-binding.ts",
} as const;

type RecoverySources = Record<keyof typeof paths, SourceFile>;

const literalFragments = (literal: string): string[] => literal
  .split("\n")
  .flatMap((line) => [line.trim(), ...line.split("||").map((part) => part.trim())])
  .filter((part) => part.length > 0);

const sourceValues = (files: readonly SourceFile[]): Set<string> =>
  new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => String(node.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .flatMap((node) => [node.getLiteralText(), ...literalFragments(node.getLiteralText())]),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .flatMap((node) => [node.getLiteralText(), ...literalFragments(node.getLiteralText())]),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead)
      .flatMap((node) => [node.getLiteralText(), ...literalFragments(node.getLiteralText())]),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
      .flatMap((node) => [node.getLiteralText(), ...literalFragments(node.getLiteralText())]),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail)
      .flatMap((node) => [node.getLiteralText(), ...literalFragments(node.getLiteralText())]),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((node) => node.getName()),
  ]));

const collectSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RecoverySources | null => {
  const entries = Object.entries(paths).map(([key, repoPath]) => {
    const file = context.project.getSourceFile(resolveFromRepo(repoPath));
    if (!file) findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/response-checkpoint-recovery",
      lawId,
      filePath: repoPath,
      message: `Response recovery source ${key} must exist.`,
    }));
    return [key, file] as const;
  });
  if (entries.some(([, file]) => !file)) return null;
  return Object.fromEntries(entries) as RecoverySources;
};

const pushMissing = (input: {
  findings: InspectorFinding[];
  lawId: string;
  checkId: string;
  filePath: string;
  values: Set<string>;
  required: readonly string[];
  message: string;
}): void => {
  const missing = input.required.filter((value) => !input.values.has(value));
  if (missing.length === 0) return;
  input.findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.message}: ${missing.join(", ")}.`,
  }));
};

const hasCheckpointPatrolShutdownFinally = (source: SourceFile): boolean =>
  source.getDescendantsOfKind(SyntaxKind.TryStatement).some((statement) =>
    statement.getFinallyBlock()
      ?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
      .some((assignment) =>
        assignment.getOperatorToken().isKind(SyntaxKind.EqualsToken)
        && Node.isIdentifier(assignment.getLeft())
        && astIdentifierName(assignment.getLeft()) === "checkpointPatrolActive"
        && assignment.getRight().isKind(SyntaxKind.FalseKeyword)) === true);

const callName = (call: CallExpression): string | undefined => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) return astIdentifierName(expression);
  return Node.isPropertyAccessExpression(expression) ? expression.getName() : undefined;
};

const callNames = (source: SourceFile, variableName: string): string[] =>
  source.getVariableDeclaration(variableName)?.getInitializer()
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((call) => callName(call) ?? []) ?? [];

const embeddedCanonicalRoutingSource = (source: SourceFile): SourceFile | null => {
  const initializer = source.getVariableDeclaration("CANONICAL_CONVERSATION_SCRIPT")
    ?.getInitializerIfKind(SyntaxKind.NoSubstitutionTemplateLiteral);
  if (!initializer) return null;
  return new Project({ useInMemoryFileSystem: true }).createSourceFile(
    "canonical-conversation-script.ts",
    `const inspectCanonicalConversation = () => {${initializer.getLiteralText()}};`,
  );
};

const subtractionMatches = (
  source: SourceFile,
  leftPath: string,
  rightPath: string,
): boolean => source.getDescendantsOfKind(SyntaxKind.BinaryExpression).some((binary) => {
  if (!binary.getOperatorToken().isKind(SyntaxKind.MinusToken)) return false;
  const left = binary.getLeft();
  const right = binary.getRight();
  const leftCall = Node.isCallExpression(left) ? left : null;
  const rightCall = Node.isCallExpression(right) ? right : null;
  if (leftCall || rightCall) {
    return Boolean(leftCall && rightCall
      && callName(leftCall) === "Number"
      && callName(rightCall) === "Number"
      && astExpressionPath(leftCall.getArguments()[0]) === leftPath
      && astExpressionPath(rightCall.getArguments()[0]) === rightPath);
  }
  return astExpressionPath(left) === leftPath && astExpressionPath(right) === rightPath;
});

const submissionOrderIsValid = (sources: RecoverySources): boolean => {
  const observedCalls = callNames(sources.submit, "waitForSubmittedTurn");
  const capture = observedCalls.indexOf("captureWebChatSubmissionProof");
  const persisted = observedCalls.indexOf("persistSubmission");
  const responseCalls = callNames(sources.shared, "executeWebChatConversation");
  const checkpointed = responseCalls.findIndex((name) => name.endsWith("onResponseCaptured"));
  const published = responseCalls.indexOf("buildCompletedWebChatResponse");
  return capture >= 0 && persisted > capture && checkpointed >= 0 && published > checkpointed;
};

const inspectCheckpointAndFailureLedger = (
  sources: RecoverySources,
  values: Set<string>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/response-checkpoint-recovery",
    filePath: paths.checkpoint,
    values,
    required: [
      "persistWebChatResponseCheckpoint",
      "readWebChatResponseCheckpoint",
      "recoverCheckpointedWebChatResponse",
      "markCheckpointedWebChatResponsePublished",
      "responseCheckpoint",
      "response_checkpointed",
      "title_finalization_pending",
      "title_verified",
      "finalized",
      "providerLeaseId",
      "assertResponseCheckpointRecovery",
      "a production checkpoint must not publish final success before title proof",
    ],
    message: "Durable checkpoint/title recovery is missing",
  });
  if (!hasCheckpointPatrolShutdownFinally(sources.feedProviderOnce)) {
    findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/checkpoint-patrol-lifecycle",
      lawId,
      filePath: paths.feedProviderOnce,
      message: "Checkpoint patrol must stop in a finally block on every outcome.",
    }));
  }
  const detachedProviderResponse = sources.feedProviderOnce
    .getDescendantsOfKind(SyntaxKind.VoidExpression)
    .some((expression) => astIdentifierName(expression.getExpression()) === "providerResponse");
  if (detachedProviderResponse) {
    findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/no-detached-post-processing-chain",
      lawId,
      filePath: paths.feedProviderOnce,
      message: "Checkpoint publication must not detach a second provider post-processing chain.",
    }));
  }
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/failure-ledger",
    filePath: paths.executionState,
    values,
    required: [
      "WebChatExecutionFailure", "occurredAt", "attemptId", "classification",
      "recoverable", "failures", "; root=", "review_required: web-chat execution is terminal:",
    ],
    message: "Traceable bounded failure ledger is missing",
  });
};

const inspectCanonicalRecovery = (
  sources: RecoverySources,
  values: Set<string>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const routingValues = sourceValues([sources.routing]);
  const directBoundedRoute = routingValues.has("focusChatGptConversationByCanonicalPath")
    && routingValues.has("canonicalPathFor")
    && routingValues.has("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable; url=");
  if (directBoundedRoute) return;
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/fresh-execution-rate-owner-transfer",
    filePath: paths.rateGuard,
    values,
    required: ["supersededExecutionId", "replacesExactPriorExecution", "xuanxue-ai-production:replacement"],
    message: "Exact fresh-execution owner transfer is missing",
  });
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/canonical-conversation-recovery",
    filePath: paths.routing,
    values,
    required: [
      "focusChatGptConversationByCanonicalPath",
      "assertWebChatCanonicalConversationBinding",
      "scroll_row", "scrollDeltaY", "reuse-exact-url",
      "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable; url=",
      "assertCanonicalConversationOwnership",
      "assertDuplicateCanonicalDomRowsAreOneLogicalRoute",
      "discoverChatGptConversationViaSearch",
    ],
    message: "Exact canonical URL plus bounded discovery recovery is missing",
  });
  const routingScript = embeddedCanonicalRoutingSource(sources.routing);
  const stableRouteOrdering = routingScript
    && subtractionMatches(routingScript, "right.actionable", "left.actionable")
    && subtractionMatches(routingScript, "left.rect.top", "right.rect.top");
  if (!stableRouteOrdering) {
    findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/canonical-conversation-recovery",
      lawId,
      filePath: paths.routing,
      message: "Exact canonical URL recovery must order duplicate renderings by actionable state and stable geometry.",
    }));
  }
  const rejectsDuplicateRenderings = routingScript?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .some((binary) => {
      const right = binary.getRight();
      return binary.getOperatorToken().isKind(SyntaxKind.GreaterThanToken)
        && ["markerCount", "rows.length"].includes(astExpressionPath(binary.getLeft()) ?? "")
        && Node.isNumericLiteral(right)
        && right.getLiteralValue() === 1;
    }) === true;
  if (rejectsDuplicateRenderings) {
    findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/canonical-dom-rendering-collapse",
      lawId,
      filePath: paths.routing,
      message: "Duplicate DOM anchors for one exact canonical pathname must not become identity ambiguity.",
    }));
  }
};

const inspectSubmissionCheckpoint = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (submissionOrderIsValid(sources)) return;
  findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: "ai-input-gateway/transient-submission-checkpoint",
    lawId,
    filePath: paths.shared,
    message: "Observed submit proof must persist before response checkpoint and final publication.",
  }));
};

const inspectIntegratedTitleFinalization = (
  sources: RecoverySources,
  values: Set<string>,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/integrated-title-finalization",
    filePath: paths.sessionController,
    values,
    required: [
      "finalizeWebChatSessionAfterResult",
      "finalizeGptWebConversationTitle",
      "runExclusivePatrol",
      "conversationTitle",
      "canonicalConversationUrl",
      "turnMarker",
      "onConversationTitleVerified",
    ],
    message: "Integrated title finalization is missing",
  });
  const forbidden = [
    "scheduleWebChatTitleHousekeeping",
    "resolveContinuationWebChatSystemTitle",
    "searchAndOpenNamedConversation",
  ];
  const liveValues = sourceValues([
    sources.managed, sources.feedProviderOnce, sources.singleTabBrowser,
    sources.routing, sources.canonicalBinding, sources.sessionController,
  ]);
  const retained = forbidden.filter((value) => liveValues.has(value));
  if (retained.length > 0) findings.push(createFinding({ evidenceMode: "static.ast",
    checkId: "ai-input-gateway/no-second-title-chain",
    lawId,
    filePath: paths.sessionController,
    message: `Title finalization must stay inside the Session Controller; second-chain symbols remain: ${retained.join(", ")}.`,
  }));
  const routingIdentifiers = new Set(sources.routing
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .map((identifier) => identifier.compilerNode.escapedText.toString()));
  if (routingIdentifiers.has("expectedTitle") || routingIdentifiers.has("systemChatTitle")) {
    findings.push(createFinding({ evidenceMode: "static.ast",
      checkId: "ai-input-gateway/title-not-routing-identity",
      lawId,
      filePath: paths.routing,
      message: "Readable provider titles must never become routing identity.",
    }));
  }
};

export const inspectAiInputGatewayRecovery = (
  context: InspectorContext,
  lawId: string,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const sources = collectSources(context, findings, lawId);
  if (!sources) return findings;
  const values = sourceValues(Object.values(sources));
  inspectCheckpointAndFailureLedger(sources, values, findings, lawId);
  inspectCanonicalRecovery(sources, values, findings, lawId);
  inspectSubmissionCheckpoint(sources, findings, lawId);
  inspectIntegratedTitleFinalization(sources, values, findings, lawId);
  return findings;
};
