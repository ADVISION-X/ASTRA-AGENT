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
  continuationTitle: "src/capabilities/ai-input-gateway/runtime/web-chat-continuation-title.ts",
  managed: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  feedProviderOnce: "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  failureClassification: "src/capabilities/ai-input-gateway/failure-classification.ts",
  rateGuard: "src/capabilities/ai-input-gateway/runtime/ai-feed-rate-guard.ts",
  identityAcceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-identity-recovery.acceptance-helper.ts",
  shared: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  submit: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  submissionCheckpoint: "src/capabilities/ai-input-gateway/providers/web-chat-submission-checkpoint.ts",
  resume: "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts",
  acceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts",
  recoveryAcceptance: "src/capabilities/ai-input-gateway/acceptance/web-chat-recovery.acceptance-helper.ts",
  chatTitle: "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  chatTitleScripts: "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
  titleHousekeeping: "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
  titleHousekeepingWorker: "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping-worker.ts",
  abilityGroup: "src/capabilities/ai-input-gateway/ability-group.ts",
  exactTargetRef: "src/lib/browser/exact-target/browser-target-ref.ts",
  exactTargetRuntime: "src/lib/browser/exact-target/browser-command-runtime.ts",
  browserContract: "src/lib/browser/browser-controller.ts",
  singleTabBrowser: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  routing: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  responseCapture: "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts",
} as const;

type RecoverySources = Record<keyof typeof paths, SourceFile>;

const sourceValues = (files: readonly SourceFile[]): Set<string> =>
  new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => String(node.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail)
      .map((node) => node.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .map((node) => node.getName()),
  ]));

const pushMissingValues = (input: {
  findings: InspectorFinding[];
  lawId: string;
  checkId: string;
  filePath: string;
  message: string;
  values: Set<string>;
  required: readonly string[];
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

const hasCheckpointPatrolShutdownFinally = (source: SourceFile): boolean =>
  source.getDescendantsOfKind(SyntaxKind.TryStatement).some((statement) =>
    statement.getFinallyBlock()
      ?.getDescendantsOfKind(SyntaxKind.BinaryExpression)
      .some((assignment) =>
        assignment.getOperatorToken().isKind(SyntaxKind.EqualsToken)
        && Node.isIdentifier(assignment.getLeft())
        && astIdentifierName(assignment.getLeft()) === "checkpointPatrolActive"
        && assignment.getRight().isKind(SyntaxKind.FalseKeyword)) === true);

const inspectCheckpointRecovery = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissingValues({
    findings,
    lawId,
    checkId: "ai-input-gateway/response-checkpoint-recovery",
    filePath: paths.checkpoint,
    message: "Response checkpoint recovery is missing",
    values: sourceValues(Object.values(sources)),
    required: [
      "persistWebChatResponseCheckpoint",
      "readWebChatResponseCheckpoint",
      "responseCheckpoint",
      "response_checkpointed",
      "recovery_pending",
      "onResponseCaptured",
      "recoverCheckpointedWebChatResponse",
      "markCheckpointedWebChatResponsePublished",
      "response_captured",
      "waitForCheckpointPublication",
      "markPostProcessingFailure",
    ],
  });
  if (!hasCheckpointPatrolShutdownFinally(sources.feedProviderOnce)) {
    findings.push(createFinding({
      checkId: "ai-input-gateway/checkpoint-patrol-lifecycle",
      lawId,
      filePath: paths.feedProviderOnce,
      message:
        "Provider success and failure must both stop the checkpoint patrol in a finally path.",
    }));
  }
};

const inspectFailureLedger = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissingValues({
    findings,
    lawId,
    checkId: "ai-input-gateway/failure-ledger",
    filePath: paths.executionState,
    message: "Traceable failure ledger is missing",
    values: sourceValues([
      sources.executionState,
      sources.failureClassification,
    ]),
    required: [
      "WebChatExecutionFailure",
      "failures",
      "classification",
      "recoverable",
      "classifyWebChatFailure",
      "isTransientProviderUnavailability",
      "terminalRootReason",
    ],
  });
  const terminalRecoveryValues = sourceValues([
    sources.executionState,
    sources.failureClassification,
    sources.identityAcceptance,
  ]);
  const terminalRecoveryMissing = [
    "; root=",
    "review_required: web-chat execution is terminal:",
  ].filter((value) =>
    ![...terminalRecoveryValues].some((candidate) =>
      candidate.includes(value)));
  if (terminalRecoveryMissing.length > 0) {
    findings.push(createFinding({
      checkId: "ai-input-gateway/failure-ledger",
      lawId,
      filePath: paths.executionState,
      message:
        "Terminal failure root preservation is missing: "
        + `${terminalRecoveryMissing.join(", ")}.`,
    }));
  }
};

const inspectFreshExecutionRateTransfer = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  pushMissingValues({
    findings,
    lawId,
    checkId: "ai-input-gateway/fresh-execution-rate-owner-transfer",
    filePath: paths.rateGuard,
    message: "Fresh execution rate-owner transfer is missing",
    values: sourceValues([
      sources.rateGuard,
      sources.identityAcceptance,
    ]),
    required: [
      "supersededExecutionId",
      "replacesExactPriorExecution",
      "xuanxue-ai-production:authorized-replacement",
      "a retired execution cannot reclaim the round after replacement",
    ],
  });
};

const inspectCheckpointAndLedger = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  inspectCheckpointRecovery(sources, findings, lawId);
  inspectFailureLedger(sources, findings, lawId);
  inspectFreshExecutionRateTransfer(sources, findings, lawId);
};

const callNames = (
  source: SourceFile,
  variableName: string,
): string[] => source
  .getVariableDeclaration(variableName)
  ?.getInitializer()
  ?.getDescendantsOfKind(SyntaxKind.CallExpression)
  .map((call) => call.getExpression().getText()) ?? [];

const submissionObservationOrderIsValid = (
  sources: RecoverySources,
): boolean => {
  const calls = callNames(
    sources.submissionCheckpoint,
    "observeSubmittedWebChatTurn",
  );
  const firstCapture = calls.findIndex((name) => name === "captureProof");
  const firstObserved = calls.findIndex(
    (name) => name === "persistObservedSubmission",
  );
  const secondCapture = calls.findIndex(
    (name, index) => index > firstObserved && name === "captureProof",
  );
  const secondObserved = calls.findIndex(
    (name, index) =>
      index > secondCapture && name === "persistObservedSubmission",
  );
  return firstCapture >= 0
    && firstObserved > firstCapture
    && secondCapture > firstObserved
    && secondObserved > secondCapture;
};

const submitFinalizationOrderIsValid = (
  sources: RecoverySources,
): boolean => {
  const finalizeCalls = callNames(
    sources.submissionCheckpoint,
    "finalizeObservedWebChatSubmission",
  );
  const submitted = finalizeCalls.findIndex((name) =>
    name.endsWith("onSubmitted"));
  const submitCalls = callNames(sources.submit, "submitPromptFromComposer");
  const observed = submitCalls.indexOf("observeSubmittedWebChatTurn");
  const attachments = submitCalls.indexOf(
    "waitForSubmittedUserMessageAttachments",
  );
  const finalized = submitCalls.indexOf(
    "finalizeObservedWebChatSubmission",
  );
  return submitted >= 0
    && observed >= 0
    && attachments > observed
    && finalized > attachments;
};

const responsePublicationOrderIsValid = (
  sources: RecoverySources,
): boolean => {
  const calls = callNames(sources.shared, "executeWebChatConversation");
  const checkpointed = calls.findIndex((name) =>
    name.endsWith("onResponseCaptured"));
  const published = calls.indexOf("buildCompletedWebChatResponse");
  return checkpointed >= 0 && published > checkpointed;
};

const inspectSubmissionOrder = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (
    !submissionObservationOrderIsValid(sources)
    || !submitFinalizationOrderIsValid(sources)
    || !responsePublicationOrderIsValid(sources)
  ) {
    findings.push(createFinding({
      checkId: "ai-input-gateway/transient-submission-checkpoint",
      lawId,
      filePath: paths.shared,
      message: "Transient submit proof, canonical proof, answer checkpoint and publication must remain ordered.",
    }));
  }
};

const RECOVERY_SURFACE_CHECKS: ReadonlyArray<{
  checkId: string;
  filePath: string;
  sourceKeys: ReadonlyArray<keyof RecoverySources>;
  required: readonly string[];
  message: string;
}> = [
    {
      checkId: "ai-input-gateway/offscreen-sidebar-recovery",
      filePath: paths.routing,
      sourceKeys: ["singleTabBrowser", "routing"],
      required: ["createSingleTabWebChatBrowser", "scroll_title", "scrollDeltaY"],
      message: "Exact-target sidebar routing is missing",
    },
    {
      checkId: "ai-input-gateway/bounded-patrol-cadence",
      filePath: paths.responseCapture,
      sourceKeys: ["responseCapture", "acceptance"],
      required: [
        "resolveManagedGptPollIntervalMs",
        "WEB_CHAT_PATROL_INTERVAL_MS",
        "DEFAULT_MANAGED_GPT_POLL_INTERVAL_MS",
      ],
      message: "Bounded operator patrol cadence is missing",
    },
    {
      checkId: "ai-input-gateway/response-checkpoint-recovery",
      filePath: paths.acceptance,
      sourceKeys: ["acceptance", "recoveryAcceptance"],
      required: [
        "assertResponseCheckpointRecovery",
        "assertFailureLedger",
        "submissionCount",
        "readWebChatResponseCheckpoint",
        "checkpoint recovery must finish before browser or provider access",
        "web-chat-response-checkpoints",
        "the execution ledger must persist the provider lease across restart",
        "providerLeaseId",
        "checkpoint publication waited for blocked title post-processing",
      ],
      message: "Checkpoint acceptance is missing",
    },
    {
      checkId: "ai-input-gateway/bounded-rename-recovery",
      filePath: paths.chatTitle,
      sourceKeys: ["chatTitle"],
      required: [
        "openTitleEditor",
        "lastRenameNotReady",
        "renameNotReady",
        "RENAME_PATROL_SLICE_MS",
        "remainingRenameMs",
      ],
      message: "Bounded title recovery is missing",
    },
    {
      checkId: "ai-input-gateway/durable-title-housekeeping",
      filePath: paths.titleHousekeeping,
      sourceKeys: [
        "executionState",
        "managed",
        "feedProviderOnce",
        "titleHousekeeping",
        "titleHousekeepingWorker",
        "abilityGroup",
        "recoveryAcceptance",
      ],
      required: [
        "WebChatTitleRenameState",
        "chatTitleRename",
        "drainWebChatTitleHousekeeping",
        "runWebChatTitleHousekeepingNow",
        "scheduleWebChatTitleHousekeeping",
        "schedulePublishedTitleHousekeeping",
        "finishTitleHousekeepingAfterRestart",
        "response_captured",
      ],
      message:
        "Published answer rename debt is not durable or restart-drainable",
    },
    {
      checkId: "ai-input-gateway/exact-rename-identity-proof",
      filePath: paths.chatTitleScripts,
      sourceKeys: ["chatTitleScripts"],
      required: [
        "expectedPath",
        "expectedTitle",
        "currentPathMatches",
        "markerCount",
        "titleLinks",
      ],
      message:
        "Final rename proof is not bound to canonical URL, title and marker",
    },
    {
      checkId: "ai-input-gateway/one-parent-conversation-title",
      filePath: paths.managed,
      sourceKeys: [
        "managed",
        "continuationTitle",
        "identityAcceptance",
      ],
      required: [
        "resolveContinuationWebChatSystemTitle",
        "earliestVerifiedTitle",
        "verifiedAt",
        "assertContinuationInheritsParentSystemTitle",
      ],
      message: "Continuation parent-title inheritance is missing",
    },
    {
      checkId: "ai-input-gateway/exact-target-identity",
      filePath: paths.exactTargetRef,
      sourceKeys: [
        "exactTargetRef",
        "exactTargetRuntime",
        "browserContract",
        "singleTabBrowser",
      ],
      required: [
        "BrowserTargetRef",
        "BrowserDocumentRef",
        "BrowserTargetSession",
        "createTargetSession",
        "createSingleTabWebChatBrowser",
      ],
      message: "Exact provider target binding is missing",
    },
];

const inspectRecoverySurfaces = (
  sources: RecoverySources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const check of RECOVERY_SURFACE_CHECKS) {
    pushMissingValues({
      findings,
      lawId,
      checkId: check.checkId,
      filePath: check.filePath,
      message: check.message,
      values: sourceValues(check.sourceKeys.map((key) => sources[key])),
      required: check.required,
    });
  }
};

export const inspectAiInputGatewayRecovery = (
  context: InspectorContext,
  lawId: string,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const sources = collectSources(context, findings, lawId);
  if (!sources) return findings;
  inspectCheckpointAndLedger(sources, findings, lawId);
  inspectSubmissionOrder(sources, findings, lawId);
  inspectRecoverySurfaces(sources, findings, lawId);
  return findings;
};
