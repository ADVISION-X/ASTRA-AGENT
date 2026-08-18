import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../shared/inspector-contracts.js";
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
  submit: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  submissionCheckpoint: "src/capabilities/ai-input-gateway/providers/web-chat-submission-checkpoint.ts",
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
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .map((node) => node.getName()),
  ]));

const collectSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RecoverySources | null => {
  const entries = Object.entries(paths).map(([key, repoPath]) => {
    const file = context.project.getSourceFile(resolveFromRepo(repoPath));
    if (!file) {
      findings.push(createFinding({
        checkId: "ai-input-gateway/response-checkpoint-recovery",
        lawId,
        filePath: repoPath,
        message: `Response recovery source ${key} must exist.`,
      }));
    }
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
  input.findings.push(createFinding({
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

const callNames = (source: SourceFile, variableName: string): string[] =>
  source.getVariableDeclaration(variableName)?.getInitializer()
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? [];

const submissionOrderIsValid = (sources: RecoverySources): boolean => {
  const observedCalls = callNames(
    sources.submissionCheckpoint,
    "observeSubmittedWebChatTurn",
  );
  const capture = observedCalls.indexOf("captureProof");
  const persisted = observedCalls.indexOf("persistObservedSubmission");
  const responseCalls = callNames(sources.shared, "executeWebChatConversation");
  const checkpointed = responseCalls.findIndex((name) =>
    name.endsWith("onResponseCaptured"));
  const published = responseCalls.indexOf("buildCompletedWebChatResponse");
  return capture >= 0 && persisted > capture
    && checkpointed >= 0 && published > checkpointed;
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
      "providerLeaseId",
      "assertResponseCheckpointRecovery",
      "checkpoint recovery must finish before browser or provider access",
    ],
    message: "Durable checkpoint recovery is missing",
  });
  if (!hasCheckpointPatrolShutdownFinally(sources.feedProviderOnce)) {
    findings.push(createFinding({
      checkId: "ai-input-gateway/checkpoint-patrol-lifecycle",
      lawId,
      filePath: paths.feedProviderOnce,
      message: "Checkpoint patrol must stop in a finally block on every outcome.",
    }));
  }
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/failure-ledger",
    filePath: paths.executionState,
    values,
    required: [
      "WebChatExecutionFailure",
      "occurredAt",
      "attemptId",
      "classification",
      "recoverable",
      "failures",
      "; root=",
      "review_required: web-chat execution is terminal:",
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
  pushMissing({
    findings,
    lawId,
    checkId: "ai-input-gateway/fresh-execution-rate-owner-transfer",
    filePath: paths.rateGuard,
    values,
    required: [
      "supersededExecutionId",
      "replacesExactPriorExecution",
      "xuanxue-ai-production:replacement",
    ],
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
      "scroll_row",
      "scrollDeltaY",
      "reuse-exact-url",
      "WEB_CHAT_BOUND_CONVERSATION_NOT_READY: canonical ChatGPT path is unavailable; url=",
      "assertCanonicalConversationOwnership",
      "assertDuplicateCanonicalDomRowsAreOneLogicalRoute",
      "Number(right.actionable) - Number(left.actionable)",
      "left.rect.top - right.rect.top",
    ],
    message: "Exact canonical URL recovery is missing",
  });
  if (sources.routing.getFullText().includes("markerCount > 1 || rows.length > 1")) {
    findings.push(createFinding({
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
  findings.push(createFinding({
    checkId: "ai-input-gateway/transient-submission-checkpoint",
    lawId,
    filePath: paths.shared,
    message: "Observed submit proof must persist before response checkpoint and publication.",
  }));
};

const inspectRetiredTitleChain = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const forbiddenTitleIdentifiers = [
    "WebChatTitleRenameState",
    "renameSubmittedChatGptConversation",
    "scheduleWebChatTitleHousekeeping",
    "resolveContinuationWebChatSystemTitle",
  ];
  const liveValues = sourceValues([
    sources.managed,
    sources.feedProviderOnce,
    sources.singleTabBrowser,
    sources.routing,
    sources.canonicalBinding,
  ]);
  const retained = forbiddenTitleIdentifiers.filter((value) => liveValues.has(value));
  if (retained.length === 0) return;
  findings.push(createFinding({
    checkId: "ai-input-gateway/title-chain-retired",
    lawId,
    filePath: paths.routing,
    message: `Provider title chain must remain absent: ${retained.join(", ")}.`,
  }));
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
  inspectRetiredTitleChain(sources, findings, lawId);
  return findings;
};
