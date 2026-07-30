import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
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
  literalVocabulary,
  propertyNames,
  pushAiInputGatewayFinding as pushFinding,
  requireAiInputGatewaySource as requireSourceFile,
  stringLiterals,
  typePropertyNames,
} from "./inspector-helpers.js";
import * as P from "./paths.js";

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
  for (const requiredIdentifier of ["attachApprovedWebChatFilesOnce", "resolveWebChatAttachmentTransportKind", "stageApprovedFiles", "waitForStableAttachmentSet", "stagingManifestHash", "onAttachmentUploadCompleted"]) {
    if (!childIds.has(requiredIdentifier)) {
      pushFinding(findings, proofLawId, P.attachment.childPath, "ai-input-gateway/attachment-child-structure", `${P.attachment.childPath} must contain ${requiredIdentifier}.`);
    }
  }
  for (const requiredLiteral of ["skipped", "ordered_clipboard", "native_picker_batch", "attachments_stable"]) {
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

const inspectNativePrimitive = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const primitive = requireSourceFile(context, findings, lawId, P.attachment.nativePrimitivePath);
  const browserContract = requireSourceFile(context, findings, lawId, P.attachment.browserContractPath);
  const browserExecution = requireSourceFile(context, findings, lawId, P.attachment.chromeBrowserExecutionPath);
  if (!primitive || !browserContract || !browserExecution) return;
  if (!identifiers(browserContract).has("selectFilesInNativePicker")) {
    pushFinding(findings, lawId, P.attachment.browserContractPath, "ai-input-gateway/browser-native-picker-contract", "BrowserController must expose the generic native multi-file picker primitive.");
  }
  const vocabulary = literalVocabulary(primitive);
  for (const forbiddenWord of ["chatgpt", "gemini", "seo", "bazi", "qimen", "八字", "奇门"]) {
    if (vocabulary.has(forbiddenWord)) {
      pushFinding(findings, lawId, P.attachment.nativePrimitivePath, "ai-input-gateway/generic-browser-primitive", `Generic native picker primitive must not contain ${forbiddenWord}.`);
    }
  }
  const nativeIdentifiers = new Set([
    ...identifiers(primitive),
    ...identifiers(browserExecution),
  ]);
  for (const requiredIdentifier of [
    "expectedFileNames",
    "stagingDirectoryPath",
    "observedFileNames",
    "NativePickerWindowIdentity",
    "NATIVE_PICKER_FOLDER_NAVIGATION_ATTEMPTS",
    "controlledWindow",
  ]) {
    if (!nativeIdentifiers.has(requiredIdentifier)) {
      pushFinding(findings, lawId, P.attachment.nativePrimitivePath, "ai-input-gateway/native-picker-proof", `Native picker primitive must contain ${requiredIdentifier}.`);
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
  const sources = [P.runtime.concurrencyLeasePath, P.executionRuntime.executionStatePath, P.runtime.singleTabBrowserPath, P.runtime.singleProviderTabPath, P.runtime.feedProviderPath, P.executionRuntime.managedExecutionPath, P.runtime.turnIdentityPath, P.acceptance.concurrencyAcceptancePath, P.acceptance.realChromeParallelAcceptancePath, P.runtime.chatTitlePath].map((repoPath) => requireSourceFile(context, findings, lawId, repoPath));
  return sources.every((source): source is SourceFile => source !== null) ? sources : null;
};

const inspectParallelIdentifiers = (sources: readonly SourceFile[], findings: Finding[], lawId: string): void => {
  const allIdentifiers = new Set(sources.flatMap((source) => [...identifiers(source)]));
  for (const required of ["resolveWebChatMaxInFlight", "acquireWebChatCapacityLease", "acquireWebChatBrowserMutationLease", "startOrResumeWebChatExecution", "createSingleTabWebChatBrowser", "focusSingleProviderTab", "renameSubmittedChatGptConversation", "captureWebChatSubmissionProof", "turnMarker", "systemChatTitle", "executionId", "capacitySlot"]) {
    if (!allIdentifiers.has(required)) {
      pushFinding(findings, lawId, P.runtime.concurrencyLeasePath, "ai-input-gateway/bounded-parallel-runtime", `Bounded parallel web-chat runtime must contain ${required}.`);
    }
  }
};

const inspectParallelAcceptanceProof = (acceptance: SourceFile, realChromeAcceptance: SourceFile, findings: Finding[], lawId: string): void => {
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
  const realChromeIdentifiers = identifiers(realChromeAcceptance);
  const realChromeStrings = stringLiterals(realChromeAcceptance);
  const realChromeProofs = [
    {
      label: "all submissions precede the first captured response",
      present: realChromeStrings.has("all exact marked turns must be submitted before the first response is captured"),
    },
    {
      label: "canonical conversation identity",
      present: realChromeIdentifiers.has("canonicalConversationUrl"),
    },
    {
      label: "turn marker isolation",
      present: realChromeIdentifiers.has("turnMarker"),
    },
    {
      label: "system chat title identity",
      present: realChromeIdentifiers.has("systemChatTitle"),
    },
    {
      label: "single physical ChatGPT tab count",
      present: realChromeIdentifiers.has("chatGptTabCountAfter"),
    },
  ];
  for (const proof of realChromeProofs) {
    if (!proof.present) {
      pushFinding(findings, lawId, P.acceptance.realChromeParallelAcceptancePath, "ai-input-gateway/parallel-acceptance", `Real Chrome concurrency acceptance must prove ${proof.label}.`);
    }
  }
};

const inspectBoundedParallelExecution = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const sources = requireParallelSources(context, findings, lawId);
  if (!sources) return;
  inspectParallelIdentifiers(sources, findings, lawId);
  inspectParallelAcceptanceProof(sources[7]!, sources[8]!, findings, lawId);
};

const inspectNoChatGptPageRefresh = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const targets = [
    {
      repoPath: P.runtime.rateLimitDialogPath,
      symbolName: "acknowledgeChatGptRateLimitDialogIfVisible",
    },
    {
      repoPath: P.runtime.recoveryPath,
      symbolName: "recoverPick3NoResultConversation",
    },
    {
      repoPath: P.runtime.historyCleanupPath,
      symbolName: "verifyHistoryDeleted",
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
  const hasRenameCall = (node: Node | undefined): boolean => Boolean(node?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => call.getExpression().getText() === "renameSubmittedChatGptConversation"));
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
  const pageActions = requireSourceFile(context, findings, lawId, P.runtime.pageActionsPath);
  const submit = requireSourceFile(context, findings, lawId, P.runtime.submitPath);
  const acceptance = requireSourceFile(context, findings, lawId, P.attachment.acceptancePath);
  if (!hygiene || !search || !pageActions || !submit || !acceptance) return;
  const combinedIdentifiers = new Set([
    ...identifiers(hygiene),
    ...identifiers(search),
    ...identifiers(pageActions),
    ...identifiers(submit),
    ...identifiers(acceptance),
  ]);
  const hygieneStrings = stringLiterals(hygiene);
  const searchCleanupCalls = search
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) =>
      call.getExpression().getText() === "dismissChatGptSearchDialogIfVisible")
    .length;
  if (
    !combinedIdentifiers.has("dismissChatGptSearchDialogIfVisible")
    || !combinedIdentifiers.has("staleSearchDialog")
    || searchCleanupCalls < 2
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

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const publicLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-001-V1");
  const routingLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-003-V1");
  const proofLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-004-V1");
  const parallelLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-005-V2");
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
  inspectNativePrimitive(context, findings, routingLawId);
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
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [P.authority.lawPath, P.authority.blueprintPath, ...P.governedPaths].sort(),
    reportJson: {
      capabilityDomain: context.planEntry.capabilityDomain,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
    },
  };
};
