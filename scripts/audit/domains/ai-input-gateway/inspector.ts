import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { selectLawId } from "../../shared/finding-utils.js";
import { astExpressionPath } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectAiInputGatewayRecovery } from "./recovery-inspector.js";
import { inspectSubmissionPriorityPatrol } from "./scheduler-inspector.js";
import {
  inspectFreshConversationIdentity,
  inspectCanonicalConversationIdentity,
} from "./identity-inspector.js";
import {
  type AiInputGatewayFinding as Finding,
  identifiers,
  propertyNames,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
  stringLiterals,
  typePropertyNames,
} from "./inspector-helpers.js";
import * as P from "./paths.js";
import { inspectConversationTopology } from "./topology-inspector.js";
import { inspectAttachmentChild } from "./attachment-inspector.js";

const literalContains = (source: SourceFile, value: string): boolean =>
  [...stringLiterals(source)].some((literal) => literal.includes(value));

const inspectPublicBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const schema = requireSourceFile(context, findings, lawId, P.attachment.schemaPath);
  const contract = requireSourceFile(context, findings, lawId, P.attachment.contractPath);
  if (!schema || !contract) return;
  const inputInitializer = schema.getVariableDeclaration("AiFeedInputSchema")?.getInitializer();
  const publicInputProperties = inputInitializer ? propertyNames(inputInitializer) : new Set<string>();
  const executeOptionProperties = typePropertyNames(contract, "AiInputGatewayExecuteOptions");
  for (const forbidden of ["transportKind", "selector", "coordinate", "tabId", "nativePicker", "fallback"]) {
    if (publicInputProperties.has(forbidden) || executeOptionProperties.has(forbidden)) {
      pushFinding(findings, lawId, P.attachment.schemaPath, "ai-input-gateway/no-public-transport-controls", `Public request/options must not expose ${forbidden}.`);
    }
  }
  if (publicInputProperties.has("maxInputChars")) {
    pushFinding(findings, lawId, P.attachment.schemaPath, "ai-input-gateway/no-local-prompt-capacity-gate", "Public AI feed input must not expose maxInputChars or any local prompt-capacity gate.");
  }
  if (typePropertyNames(contract, "AiInputGatewayAbilityGroup").has("preflightApprovedWebChatFiles")) {
    pushFinding(findings, lawId, P.attachment.contractPath, "ai-input-gateway/no-detached-provider-preflight", "AI Input Gateway must not expose a detached provider attachment preflight surface.");
  }
  const abilityGroup = requireSourceFile(context, findings, lawId, "src/capabilities/ai-input-gateway/ability-group.ts");
  const abilityGroupValues = abilityGroup
    ? new Set([...identifiers(abilityGroup), ...stringLiterals(abilityGroup)])
    : new Set<string>();
  if (["preflightApprovedWebChatFiles", "runPreflightAttachment", "provider-input-preflight"]
    .some((value) => abilityGroupValues.has(value))) {
    pushFinding(findings, lawId, "src/capabilities/ai-input-gateway/ability-group.ts", "ai-input-gateway/no-detached-provider-preflight", "AI Input Gateway implementation must not retain a detached provider preflight or upload-clear-reupload path.");
  }
  const inputPackage = requireSourceFile(context, findings, lawId, "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts");
  if (inputPackage && identifiers(inputPackage).has("maxInputChars")) {
    pushFinding(findings, lawId, "src/capabilities/ai-input-gateway/runtime/ai-feed-input-package.ts", "ai-input-gateway/no-local-prompt-capacity-gate", "AI feed packaging must not reject governed prompt text by local character capacity.");
  }
  if (!executeOptionProperties.has("onAttachmentUploadCompleted")) {
    pushFinding(findings, lawId, P.attachment.contractPath, "ai-input-gateway/aggregate-progress-callback", "Execute options must expose only the aggregate attachment terminal callback.");
  }
  for (const required of ["taskIdentity", "AiTaskLabelKeySchema"]) {
    if (!identifiers(schema).has(required)) {
      pushFinding(findings, lawId, P.attachment.schemaPath, "ai-input-gateway/structured-task-identity", `AI feed schema must declare ${required}.`);
    }
  }
};

const inspectRemovedRegion = (findings: Finding[], lawId: string): void => {
  for (const removedPath of Object.values(P.removed)) {
    if (existsSync(resolveFromRepo(removedPath))) {
      pushFinding(findings, lawId, removedPath, "ai-input-gateway/removed-old-region", `${removedPath} must remain deleted.`);
    }
  }
};

const requireParallelSources = (context: InspectorContext, findings: Finding[], lawId: string): SourceFile[] | null => {
  const sources = [P.runtime.concurrencyLeasePath, P.executionRuntime.executionStatePath, P.runtime.singleTabBrowserPath, P.attachment.exactTargetRefPath, P.runtime.feedProviderPath, P.executionRuntime.managedExecutionPath, P.runtime.turnIdentityPath, P.acceptance.concurrencyAcceptancePath, P.runtime.singleTabRoutingPath].map((repoPath) => requireSourceFile(context, findings, lawId, repoPath));
  return sources.every((source): source is SourceFile => source !== null) ? sources : null;
};

const inspectParallelIdentifiers = (sources: readonly SourceFile[], findings: Finding[], lawId: string): void => {
  const allIdentifiers = new Set(sources.flatMap((source) => [...identifiers(source)]));
  for (const required of ["resolveWebChatMaxInFlight", "acquireWebChatCapacityLease", "acquireWebChatBrowserMutationLease", "startOrResumeWebChatExecution", "createSingleTabWebChatBrowser", "BrowserTargetRef", "captureWebChatSubmissionProof", "focusChatGptConversationByCanonicalPath", "turnMarker", "executionId", "capacitySlot"]) {
    if (!allIdentifiers.has(required)) {
      pushFinding(findings, lawId, P.runtime.concurrencyLeasePath, "ai-input-gateway/bounded-parallel-runtime", `Bounded parallel web-chat runtime must contain ${required}.`);
    }
  }
};

const inspectParallelAcceptanceProof = (acceptance: SourceFile, findings: Finding[], lawId: string): void => {
  const acceptanceIdentifiers = identifiers(acceptance);
  const acceptanceStrings = stringLiterals(acceptance);
  const acceptanceNumbers = new Set(acceptance.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((node) => node.getLiteralValue()));
  const acceptanceProofs = [
    { label: "ten in-flight workers", present: acceptanceNumbers.has(10) },
    {
      label: "N+1 waiting marker",
      present: acceptanceStrings.has("entered-11"),
    },
    {
      label: "single browser mutation lane",
      present: acceptanceIdentifiers.has("secondMutationEntered"),
    },
    {
      label: "configurable capacity",
      present: acceptanceIdentifiers.has("WEB_CHAT_MAX_IN_FLIGHT"),
    },
  ];
  for (const proof of acceptanceProofs) {
    if (!proof.present) {
      pushFinding(findings, lawId, P.acceptance.concurrencyAcceptancePath, "ai-input-gateway/parallel-acceptance", `Concurrency acceptance must prove ${proof.label}.`);
    }
  }
};

const inspectBoundedParallelExecution = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const sources = requireParallelSources(context, findings, lawId);
  if (!sources) return;
  inspectParallelIdentifiers(sources, findings, lawId);
  inspectParallelAcceptanceProof(sources[7]!, findings, lawId);
};

const inspectSerialProviderBrowserActions = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  for (const repoPath of P.serialBrowserActionPaths) {
    const source = requireSourceFile(context, findings, lawId, repoPath);
    if (!source) continue;
    const parallelBrowserBatch = source
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => astExpressionPath(call.getExpression()) === "Promise.all"
        || astExpressionPath(call.getExpression()) === "Promise.allSettled");
    if (parallelBrowserBatch) {
      pushFinding(
        findings,
        lawId,
        repoPath,
        "ai-input-gateway/serial-provider-browser-actions",
        "Provider page observations must await BrowserTargetLease commands one at a time; Promise fan-out bypasses the single browser mutation lane.",
      );
    }
  }
};

const inspectNoChatGptPageRefresh = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const targets = [
    {
      repoPath: P.runtime.rateLimitDialogPath,
      symbolName: "acknowledgeChatGptRateLimitDialogIfVisible",
    },
  ] as const;
  for (const target of targets) {
    const source = requireSourceFile(context, findings, lawId, target.repoPath);
    if (!source) continue;
    const symbolNode = source.getFunction(target.symbolName) ?? source.getVariableDeclaration(target.symbolName)?.getInitializer();
    if (!symbolNode) {
      pushFinding(findings, lawId, target.repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${target.repoPath} must expose ${target.symbolName} for no-refresh enforcement.`);
      continue;
    }
    const refreshCallFound = symbolNode
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .some((call) => {
        const path = astExpressionPath(call.getExpression());
        return path === "reload" || path === "refresh" || path === "location.reload";
      });
    if (refreshCallFound) {
      pushFinding(findings, lawId, target.repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${target.symbolName} must not refresh or reload the ChatGPT page.`);
    }
  }
  for (const repoPath of [P.runtime.rateLimitDialogPath, P.runtime.recoveryPath, P.runtime.singleTabRoutingPath]) {
    const source = requireSourceFile(context, findings, lawId, repoPath);
    if (source && stringLiterals(source).has("rate_limit_ack_clicked_and_same_tab_refreshed")) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${repoPath} must not retain the removed acknowledgement-and-refresh status.`);
    }
  }
};

const inspectSharedRateLimitWatcher = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const watcher = requireSourceFile(context, findings, lawId, P.runtime.rateLimitDialogPath);
  const managed = requireSourceFile(context, findings, lawId, P.executionRuntime.managedExecutionPath);
  const singleTab = requireSourceFile(context, findings, lawId, P.runtime.singleTabBrowserPath);
  if (!watcher || !managed || !singleTab) return;
  if (
    !identifiers(watcher).has("sharedAcknowledgementWatchers")
    || !identifiers(watcher).has("refCount")
    || !identifiers(managed).has("globalBrowser")
    || !identifiers(singleTab).has("globalBrowser")
  ) {
    pushFinding(findings, lawId, P.runtime.rateLimitDialogPath, "ai-input-gateway/shared-rate-limit-watcher", "The single physical ChatGPT tab must use one shared unrouted acknowledgement watcher.");
  }
};
const inspectLiveGenerationProof = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const evaluation = requireSourceFile(context, findings, lawId, P.runtime.answerSupportPath);
  if (!evaluation) return;
  const evaluationIds = identifiers(evaluation);
  if (
    !evaluationIds.has("currentGenerationState")
    || !evaluationIds.has("generating")
    || !evaluationIds.has("lastGenerating")
    || !literalContains(evaluation, "button[aria-label*='Stop']")
    || !literalContains(evaluation, "button[aria-label*='停止']")
  ) {
    pushFinding(findings, lawId, P.runtime.answerSupportPath, "ai-input-gateway/live-generation-proof", "Live loading/shimmer DOM must remain generating until the exact answer completes.");
  }
};
const inspectTransientPatrolRetry = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const answer = requireSourceFile(context, findings, lawId, P.runtime.answerSupportPath);
  const capture = requireSourceFile(context, findings, lawId, P.runtime.responseCapturePath);
  const routing = requireSourceFile(context, findings, lawId, P.runtime.singleTabRoutingPath);
  const acceptance = requireSourceFile(context, findings, lawId, P.acceptance.transientPatrolAcceptancePath);
  if (!answer || !capture || !routing || !acceptance) return;
  if (
    !identifiers(answer).has("isTransientNavigationExtractionError")
    || !identifiers(capture).has("webChatExecution")
    || !identifiers(routing).has("focusChatGptConversationByCanonicalPath")
    || !identifiers(acceptance).has("assertTransientPatrolRemainsRetryable")
    || !stringLiterals(acceptance).has("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact submitted ChatGPT sidebar row is not ready for marker verification")
  ) {
    pushFinding(findings, lawId, P.runtime.answerSupportPath, "ai-input-gateway/live-generation-proof", "A submitted sidebar row that is not yet focusable must remain retryable across response preflight and before-poll routing.");
  }
};

const countCanonicalSubmissionBindings = (singleTab: SourceFile): number =>
  singleTab.getDescendantsOfKind(SyntaxKind.IfStatement).filter((statement) => {
    const condition = statement.getExpression();
    if (!Node.isCallExpression(condition)
      || astExpressionPath(condition.getExpression()) !== "isRoutableWebChatSubmission"
      || condition.getArguments().length !== 1) return false;
    const thenStatement = statement.getThenStatement();
    if (!Node.isExpressionStatement(thenStatement)) return false;
    const assignment = thenStatement.getExpression();
    return Node.isBinaryExpression(assignment)
      && assignment.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && astExpressionPath(assignment.getLeft()) === "state.submission"
      && astExpressionPath(assignment.getRight()) === "submission";
  }).length;

const hasCanonicalRouteGuard = (singleTab: SourceFile): boolean =>
  singleTab.getDescendantsOfKind(SyntaxKind.IfStatement).some((statement) => {
    const condition = statement.getExpression();
    const operand = Node.isPrefixUnaryExpression(condition)
      ? condition.getOperand()
      : undefined;
    return Node.isPrefixUnaryExpression(condition)
      && condition.getOperatorToken() === SyntaxKind.ExclamationToken
      && operand !== undefined
      && Node.isCallExpression(operand)
      && astExpressionPath(operand.getExpression()) === "isRoutableWebChatSubmission"
      && operand.getArguments().length === 1
      && Node.isReturnStatement(statement.getThenStatement());
  });

const hasCanonicalResumeGuard = (singleTab: SourceFile): boolean =>
  singleTab.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((assignment) => {
    const initializer = assignment.getInitializer();
    const canonicalSubmission = initializer
      && Node.isConditionalExpression(initializer)
      ? initializer.getCondition()
      : undefined;
    return assignment.getName() === "submission"
      && canonicalSubmission !== undefined
      && Node.isCallExpression(canonicalSubmission)
      && astExpressionPath(canonicalSubmission.getExpression()) === "isRoutableWebChatSubmission"
      && canonicalSubmission.getArguments().length === 1
      && astExpressionPath(canonicalSubmission.getArguments()[0]) === "input.resumeSubmission";
  });

const inspectTransientSubmissionIsNotRoutable = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const singleTab = requireSourceFile(
    context,
    findings,
    lawId,
    P.runtime.singleTabBrowserPath,
  );
  const acceptance = requireSourceFile(
    context,
    findings,
    lawId,
    P.acceptance.sourceContractAcceptancePath,
  );
  if (!singleTab || !acceptance) return;
  if (
    !identifiers(singleTab).has("isRoutableWebChatSubmission")
    || !hasCanonicalRouteGuard(singleTab)
    || countCanonicalSubmissionBindings(singleTab) !== 2
    || !hasCanonicalResumeGuard(singleTab)
    || !stringLiterals(acceptance).has(
      "a transient WEB submission receipt must prevent resubmission without becoming a route identity",
    )
    || !stringLiterals(acceptance).has(
      "only a verified canonical conversation may become routable",
    )
  ) {
    pushFinding(
      findings,
      lawId,
      P.runtime.singleTabBrowserPath,
      "ai-input-gateway/transient-submission-not-routable",
      "A transient /c/WEB: receipt may prevent resubmission but only a verified canonical conversation may bind or drive single-tab routing.",
    );
  }
};
const inspectTransientOverlayHygiene = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const hygiene = requireSourceFile(context, findings, lawId, P.runtime.searchDialogHygienePath);
  const submit = requireSourceFile(context, findings, lawId, P.runtime.submitPath);
  const abilityGroup = requireSourceFile(context, findings, lawId, "src/capabilities/ai-input-gateway/ability-group.ts");
  const acceptance = requireSourceFile(context, findings, lawId, P.attachment.acceptancePath);
  if (!hygiene || !submit || !abilityGroup || !acceptance) return;
  const combinedIdentifiers = new Set([
    ...identifiers(hygiene),
    ...identifiers(submit),
    ...identifiers(abilityGroup),
    ...identifiers(acceptance),
  ]);
  const hygieneStrings = stringLiterals(hygiene);
  const searchCleanupCalls = [submit, abilityGroup].flatMap((sourceFile) => sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) =>
      astExpressionPath(call.getExpression()) === "dismissChatGptSearchDialogIfVisible"));
  if (
    !combinedIdentifiers.has("dismissChatGptSearchDialogIfVisible")
    || searchCleanupCalls.length !== 1
    || !hygieneStrings.has("CHATGPT_SEARCH_DIALOG_AMBIGUOUS")
    || !hygieneStrings.has("CHATGPT_SEARCH_DIALOG_CLOSE_AMBIGUOUS")
    || !hygieneStrings.has("CHATGPT_SEARCH_DIALOG_STILL_VISIBLE")
    || identifiers(submit).has("dismissFloatingMenus")
  ) {
    pushFinding(
      findings,
      lawId,
      P.runtime.searchDialogHygienePath,
      "ai-input-gateway/transient-overlay-hygiene",
      "Attachment selection and prompt focus must close only one exact harmless chat-search dialog and verify disappearance without universal Escape cleanup.",
    );
  }
};
const inspectGeneratedImageCapture = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const capture = requireSourceFile(context, findings, lawId, P.runtime.generatedImageCapturePath);
  if (!capture) return;
  const values = new Set([...identifiers(capture), ...stringLiterals(capture)]);
  for (const required of [
    "captureChatGptGeneratedImage",
    "promptMatched",
    "assistantIndex",
    "decideGeneratedImageAssistantTurn",
    "generatedImageTurnHasSubstantiveContent",
    "data-turn",
    "HTMLElement",
    'button[aria-label="保存"]',
    "logicalSources",
    "findGeneratedImageCard",
    "waitForNewDownload",
    "review_required: more than one new image download appeared during generated image capture",
  ]) {
    if (!values.has(required)) {
      pushFinding(findings, lawId, P.runtime.generatedImageCapturePath, "ai-input-gateway/exact-generated-image-turn", `Generated image capture must contain ${required}.`);
    }
  }
  for (const retired of ['label === "download"', 'label === "下载"']) {
    if (stringLiterals(capture).has(retired)) {
      pushFinding(findings, lawId, P.runtime.generatedImageCapturePath, "ai-input-gateway/exact-generated-image-viewer-save", `Generated image capture must not retain retired viewer identity ${retired}.`);
    }
  }
};
const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const publicLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-001-V1");
  const routingLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-003-V1");
  const proofLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-004-V1");
  const parallelLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-005-V4");
  const findings: Finding[] = [];
  for (const authorityPath of [P.authority.lawPath, P.authority.blueprintPath]) {
    if (!existsSync(resolveFromRepo(authorityPath))) {
      pushFinding(findings, publicLawId, authorityPath, "ai-input-gateway/authority-present", `${authorityPath} must exist.`);
    }
  }
  for (const repoPath of P.governedPaths) {
    const absolutePath = resolveFromRepo(repoPath);
    if (!context.project.getSourceFile(absolutePath)) {
      requireSourceFile(context, findings, publicLawId, repoPath);
    }
  }
  inspectPublicBoundary(context, findings, publicLawId);
  inspectAttachmentChild(context, findings, routingLawId, proofLawId);
  inspectRemovedRegion(findings, routingLawId);
  inspectBoundedParallelExecution(context, findings, parallelLawId);
  inspectSerialProviderBrowserActions(context, findings, parallelLawId);
  inspectFreshConversationIdentity(context, findings, parallelLawId);
  inspectNoChatGptPageRefresh(context, findings, parallelLawId);
  inspectCanonicalConversationIdentity(context, findings, parallelLawId);
  findings.push(...inspectAiInputGatewayRecovery(context, parallelLawId));
  inspectSubmissionPriorityPatrol(context, findings, parallelLawId);
  inspectSharedRateLimitWatcher(context, findings, parallelLawId);
  inspectLiveGenerationProof(context, findings, parallelLawId);
  inspectTransientPatrolRetry(context, findings, parallelLawId);
  inspectTransientSubmissionIsNotRoutable(context, findings, parallelLawId);
  inspectTransientOverlayHygiene(context, findings, parallelLawId);
  inspectGeneratedImageCapture(context, findings, parallelLawId);
  inspectConversationTopology(context, findings, parallelLawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [P.authority.lawPath, P.authority.blueprintPath, ...P.governedPaths].sort(),
    reportJson: {
      capabilityDomain: context.planEntry.capabilityDomain,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
    },
  };
};
export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("ai-input-gateway requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
