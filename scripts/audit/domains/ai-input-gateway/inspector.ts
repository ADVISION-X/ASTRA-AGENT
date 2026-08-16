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
  inspectHumanReadableSystemChatTitle,
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
  if (!executeOptionProperties.has("onAttachmentUploadCompleted")) {
    pushFinding(findings, lawId, P.attachment.contractPath, "ai-input-gateway/aggregate-progress-callback", "Execute options must expose only the aggregate attachment terminal callback.");
  }
  for (const required of ["taskIdentity", "AiTaskLabelKeySchema"]) {
    if (!identifiers(schema).has(required)) {
      pushFinding(findings, lawId, P.attachment.schemaPath, "ai-input-gateway/structured-task-identity", `AI feed schema must declare ${required}.`);
    }
  }
};

const inspectAttachmentChild = (context: InspectorContext, findings: Finding[], routingLawId: string, proofLawId: string): void => {
  const child = requireSourceFile(context, findings, routingLawId, P.attachment.childPath);
  const shared = requireSourceFile(context, findings, routingLawId, P.attachment.sharedPath);
  const adapterContract = requireSourceFile(context, findings, proofLawId, P.attachment.adapterContractPath);
  if (!child || !shared || !adapterContract) return;
  const childIds = identifiers(child);
  const childStrings = stringLiterals(child);
  for (const requiredIdentifier of ["attachApprovedWebChatFilesOnce", "attachByExactTargetFileInputBatch", "resolveWebChatAttachmentTransportKind", "stageApprovedFiles", "waitForStableAttachmentSet", "stagingManifestHash", "onAttachmentUploadCompleted"]) {
    if (!childIds.has(requiredIdentifier)) {
      pushFinding(findings, proofLawId, P.attachment.childPath, "ai-input-gateway/attachment-child-structure", `${P.attachment.childPath} must contain ${requiredIdentifier}.`);
    }
  }
  for (const requiredLiteral of ["skipped", "exact_target_file_input_batch", "attachments_stable"]) {
    if (!childStrings.has(requiredLiteral)) {
      pushFinding(findings, routingLawId, P.attachment.childPath, "ai-input-gateway/fixed-routing-literal", `${P.attachment.childPath} must declare ${requiredLiteral}.`);
    }
  }
  const forbiddenImports = child
    .getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.includes("web-chat-submit") || specifier.includes("web-chat-answer"));
  for (const specifier of forbiddenImports) {
    pushFinding(findings, routingLawId, P.attachment.childPath, "ai-input-gateway/attachment-child-terminal-boundary", `Attachment child must not import ${specifier}.`);
  }
  if (!identifiers(shared).has("attachApprovedWebChatFilesOnce")) {
    pushFinding(findings, routingLawId, P.attachment.sharedPath, "ai-input-gateway/shared-child-integration", "The web-chat main flow must delegate attachments to the standard child.");
  }
  const proofProperties = typePropertyNames(adapterContract, "WebChatAttachmentUploadProof");
  for (const field of ["uploadAttemptId", "transportKind", "expectedFileCount", "detectedFileCount", "stagingManifestHash", "files", "startedAt", "endedAt", "status", "failureReason", "reviewRequiredReason"]) {
    if (!proofProperties.has(field)) {
      pushFinding(findings, proofLawId, P.attachment.adapterContractPath, "ai-input-gateway/aggregate-proof-field", `Aggregate attachment proof must contain ${field}.`);
    }
  }
};

const inspectRemovedRegion = (findings: Finding[], lawId: string): void => {
  for (const removedPath of [P.removed.removedUploadPath, P.removed.removedAcceptancePath, P.removed.removedSerialLeasePath, P.removed.removedSerialAcceptancePath]) {
    if (existsSync(resolveFromRepo(removedPath))) {
      pushFinding(findings, lawId, removedPath, "ai-input-gateway/removed-old-region", `${removedPath} must remain deleted.`);
    }
  }
};

const requireParallelSources = (context: InspectorContext, findings: Finding[], lawId: string): SourceFile[] | null => {
  const sources = [P.runtime.concurrencyLeasePath, P.executionRuntime.executionStatePath, P.runtime.singleTabBrowserPath, P.attachment.exactTargetRefPath, P.runtime.feedProviderPath, P.executionRuntime.managedExecutionPath, P.runtime.turnIdentityPath, P.acceptance.concurrencyAcceptancePath, P.runtime.chatTitlePath].map((repoPath) => requireSourceFile(context, findings, lawId, repoPath));
  return sources.every((source): source is SourceFile => source !== null) ? sources : null;
};

const inspectParallelIdentifiers = (sources: readonly SourceFile[], findings: Finding[], lawId: string): void => {
  const allIdentifiers = new Set(sources.flatMap((source) => [...identifiers(source)]));
  for (const required of ["resolveWebChatMaxInFlight", "acquireWebChatCapacityLease", "acquireWebChatBrowserMutationLease", "startOrResumeWebChatExecution", "createSingleTabWebChatBrowser", "BrowserTargetRef", "renameSubmittedChatGptConversation", "captureWebChatSubmissionProof", "turnMarker", "systemChatTitle", "executionId", "capacitySlot"]) {
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

const inspectNoChatGptPageRefresh = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const targets = [
    {
      repoPath: P.runtime.rateLimitDialogPath,
      symbolName: "acknowledgeChatGptRateLimitDialogIfVisible",
    },
    {
      repoPath: P.runtime.singleTabRoutingPath,
      symbolName: "focusNamedChatGptConversation",
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
    const hasPageOpenCall = symbolNode.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "open";
    });
    if (hasPageOpenCall) {
      pushFinding(findings, lawId, target.repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${target.symbolName} must not refresh, reload, reopen, or navigate the ChatGPT page.`);
    }
  }
  for (const repoPath of [P.runtime.rateLimitDialogPath, P.runtime.recoveryPath, P.runtime.singleTabRoutingPath]) {
    const source = requireSourceFile(context, findings, lawId, repoPath);
    if (source && stringLiterals(source).has("rate_limit_ack_clicked_and_same_tab_refreshed")) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${repoPath} must not retain the removed acknowledgement-and-refresh status.`);
    }
  }
};

const inspectExactSidebarRename = (
  chatTitleScripts: SourceFile,
  findings: Finding[],
  lawId: string,
): void => {
  const titleStrings = stringLiterals(chatTitleScripts);
  for (const required of ["^/c/(?!WEB:)[^/?#]+(?:[?#].*)?$", "li"]) {
    if (!titleStrings.has(required)) {
      pushFinding(findings, lawId, P.runtime.chatTitleScriptsPath, "ai-input-gateway/exact-sidebar-row-rename", `ChatGPT rename targeting must declare the exact string literal ${required}.`);
    }
  }
  if (identifiers(chatTitleScripts).has("depth")) {
    pushFinding(findings, lawId, P.runtime.chatTitleScriptsPath, "ai-input-gateway/exact-sidebar-row-rename", "ChatGPT rename targeting must not climb into the page-header conversation menu.");
  }
};
const inspectAtomicRenameWiring = (
  sources: readonly (readonly [string, SourceFile])[],
  findings: Finding[],
  lawId: string,
): void => {
  for (const [repoPath, source] of sources) {
    if (!identifiers(source).has("runExclusivePatrol")) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/atomic-completed-chat-rename", `${repoPath} must wire runExclusivePatrol for one non-interleavable rename transaction.`);
    }
  }
};
const inspectCompletedConversationRename = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const shared = requireSourceFile(context, findings, lawId, P.attachment.sharedPath);
  const chatTitle = requireSourceFile(context, findings, lawId, P.runtime.chatTitlePath);
  const scripts = requireSourceFile(context, findings, lawId, P.runtime.chatTitleScriptsPath);
  const adapter = requireSourceFile(context, findings, lawId, P.attachment.adapterContractPath);
  const browser = requireSourceFile(context, findings, lawId, P.runtime.singleTabBrowserPath);
  const managed = requireSourceFile(context, findings, lawId, P.executionRuntime.managedExecutionPath);
  if (!shared || !chatTitle || !scripts || !adapter || !browser || !managed) return;
  const submitFlow = shared.getVariableDeclaration("executeWebChatConversation")?.getInitializer();
  const completedFlow = shared.getVariableDeclaration("buildCompletedWebChatResponse")?.getInitializer();
  const hasRenameCall = (node: Node | undefined): boolean => Boolean(node?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => astExpressionPath(call.getExpression()) === "renameSubmittedChatGptConversation"));
  if (hasRenameCall(submitFlow)) {
    pushFinding(findings, lawId, P.attachment.sharedPath, "ai-input-gateway/deferred-completed-chat-rename", "Submission must release the browser mutation lane before the provider answer exposes its rename menu.");
  }
  if (!hasRenameCall(completedFlow)) {
    pushFinding(findings, lawId, P.attachment.sharedPath, "ai-input-gateway/deferred-completed-chat-rename", "A completed ChatGPT response must schedule exact row-scoped rename as bounded post-publication housekeeping.");
  }
  inspectExactSidebarRename(scripts, findings, lawId);
  inspectAtomicRenameWiring([
    [P.attachment.adapterContractPath, adapter],
    [P.runtime.singleTabBrowserPath, browser],
    [P.executionRuntime.managedExecutionPath, managed],
    [P.runtime.chatTitlePath, chatTitle],
  ], findings, lawId);
  if (!stringLiterals(chatTitle).has("WEB_CHAT_RENAME_NOT_READY")) {
    pushFinding(findings, lawId, P.runtime.chatTitlePath, "ai-input-gateway/retryable-completed-chat-rename", "Transient ChatGPT rename UI must remain retryable without discarding the captured answer.");
  }
  if (
    !identifiers(chatTitle).has("RENAME_PATROL_SLICE_MS")
    || !identifiers(chatTitle).has("remainingRenameMs")
    || chatTitle.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .some((property) =>
        property.getName() === "timeoutMs"
        && property.getInitializerIfKind(SyntaxKind.NumericLiteral)
          ?.getLiteralValue() === 60_000)
  ) {
    pushFinding(findings, lawId, P.runtime.chatTitlePath, "ai-input-gateway/submission-priority-over-rename", "A rename patrol slice must be bounded to fifteen seconds, release the browser lane when UI is not ready, and never retain a sixty-second in-lock title wait.");
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
  const evaluation = requireSourceFile(context, findings, lawId, P.runtime.answerEvaluationPath);
  const acceptance = requireSourceFile(context, findings, lawId, P.acceptance.sourceContractAcceptancePath);
  if (!evaluation || !acceptance) return;
  const acceptanceIds = identifiers(acceptance);
  const acceptanceText = stringLiterals(acceptance);
  if (
    !evaluation.getVariableDeclaration("WEB_CHAT_STATUS_TEXT_SCRIPT")
    || !acceptanceIds.has("answerEvaluation")
    || !acceptanceText.has("visibleProgressClass")
    || !acceptanceText.has("[class*='shimmer']")
  ) {
    pushFinding(findings, lawId, P.runtime.answerEvaluationPath, "ai-input-gateway/live-generation-proof", "Live loading/shimmer DOM must remain generating until the exact answer completes.");
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
    || !identifiers(routing).has("focusUnrenamedChatGptConversation")
    || !identifiers(acceptance).has("assertTransientPatrolRemainsRetryable")
    || !stringLiterals(acceptance).has("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact submitted ChatGPT sidebar row is not ready for marker verification")
  ) {
    pushFinding(findings, lawId, P.runtime.answerSupportPath, "ai-input-gateway/live-generation-proof", "A submitted sidebar row that is not yet focusable must remain retryable across response preflight and before-poll routing.");
  }
};
const inspectTransientOverlayHygiene = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const hygiene = requireSourceFile(context, findings, lawId, P.runtime.searchDialogHygienePath);
  const search = requireSourceFile(context, findings, lawId, P.runtime.namedConversationSearchPath);
  const submit = requireSourceFile(context, findings, lawId, P.runtime.submitPath);
  const abilityGroup = requireSourceFile(context, findings, lawId, "src/capabilities/ai-input-gateway/ability-group.ts");
  const acceptance = requireSourceFile(context, findings, lawId, P.attachment.acceptancePath);
  if (!hygiene || !search || !submit || !abilityGroup || !acceptance) return;
  const combinedIdentifiers = new Set([
    ...identifiers(hygiene),
    ...identifiers(search),
    ...identifiers(submit),
    ...identifiers(abilityGroup),
    ...identifiers(acceptance),
  ]);
  const hygieneStrings = stringLiterals(hygiene);
  const searchCleanupCalls = [search, submit, abilityGroup].flatMap((sourceFile) => sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) =>
      astExpressionPath(call.getExpression()) === "dismissChatGptSearchDialogIfVisible"));
  if (
    !combinedIdentifiers.has("dismissChatGptSearchDialogIfVisible")
    || searchCleanupCalls.length < 2
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
      "Search routing, attachment selection and prompt focus must close only one exact harmless chat-search dialog and verify disappearance without universal Escape cleanup.",
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
    "markedUserTurns",
    "assistantIndex",
    "logicalSources",
    "downloadButtons",
    "waitForNewDownload",
    "review_required: more than one new image download appeared during generated image capture",
  ]) {
    if (!values.has(required)) {
      pushFinding(findings, lawId, P.runtime.generatedImageCapturePath, "ai-input-gateway/exact-generated-image-turn", `Generated image capture must contain ${required}.`);
    }
  }
};
const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const publicLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-001-V1");
  const routingLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-003-V1");
  const proofLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-004-V1");
  const parallelLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-005-V3");
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
  inspectFreshConversationIdentity(context, findings, parallelLawId);
  inspectNoChatGptPageRefresh(context, findings, parallelLawId);
  inspectCompletedConversationRename(context, findings, parallelLawId);
  inspectHumanReadableSystemChatTitle(context, findings, parallelLawId);
  findings.push(...inspectAiInputGatewayRecovery(context, parallelLawId));
  inspectSubmissionPriorityPatrol(context, findings, parallelLawId);
  inspectSharedRateLimitWatcher(context, findings, parallelLawId);
  inspectLiveGenerationProof(context, findings, parallelLawId);
  inspectTransientPatrolRetry(context, findings, parallelLawId);
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
