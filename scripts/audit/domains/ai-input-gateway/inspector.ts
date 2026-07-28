import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectAiInputGatewayRecovery } from "./recovery-inspector.js";
import { inspectSubmissionPriorityPatrol } from "./scheduler-inspector.js";

type Finding = ReturnType<typeof createFinding>;

const lawPath = ".github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md";
const schemaPath = "src/capabilities/ai-input-gateway/schema.ts";
const contractPath = "src/capabilities/ai-input-gateway/contract.ts";
const adapterContractPath = "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts";
const childPath = "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts";
const sharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
const orderedTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-ordered-clipboard-attachment.ts";
const nativeTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-native-picker-attachment.ts";
const attachmentTransportPath = "src/capabilities/ai-input-gateway/providers/web-chat-attachment-transport.ts";
const composerScriptsPath = "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts";
const browserContractPath = "src/lib/browser/browser-controller.ts";
const nativePrimitivePath = "src/lib/browser/current-chrome-native-multi-file-picker.ts";
const chromeWindowControlPath = "src/lib/browser/current-chrome-window-control.ts";
const chromeBrowserPrimitivesPath = "src/lib/browser/current-chrome-browser-controller-primitives.ts";
const acceptancePath = "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts";
const concurrencyLeasePath = "src/capabilities/ai-input-gateway/runtime/web-chat-concurrency-lease.ts";
const schedulerLedgerPath = "src/capabilities/ai-input-gateway/runtime/web-chat-scheduler-ledger.ts";
const executionStatePath = "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts";
const systemChatTitlePath = "src/capabilities/ai-input-gateway/runtime/web-chat-system-title.ts";
const responseCheckpointPath = "src/capabilities/ai-input-gateway/runtime/web-chat-response-checkpoint.ts";
const singleTabBrowserPath = "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts";
const singleProviderTabPath = "src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts";
const feedProviderPath = "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts";
const managedExecutionPath = "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts";
const failureClassificationPath = "src/capabilities/ai-input-gateway/failure-classification.ts";
const turnIdentityPath = "src/capabilities/ai-input-gateway/providers/web-chat-turn-identity.ts";
const chatTitlePath = "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts";
const chatTitleScriptsPath = "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts";
const responseCapturePath = "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts";
const answerEvaluationPath = "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts";
const answerSupportPath = "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts";
const resumePath = "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts";
const rateLimitDialogPath = "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts";
const recoveryPath = "src/capabilities/ai-input-gateway/providers/web-chat-recovery.ts";
const historyCleanupPath = "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts";
const singleTabRoutingPath = "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts";
const namedConversationSearchPath = "src/capabilities/ai-input-gateway/runtime/web-chat-named-conversation-search.ts";
const concurrencyAcceptancePath = "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts";
const transientPatrolAcceptancePath = "src/capabilities/ai-input-gateway/acceptance/web-chat-transient-patrol.acceptance-helper.ts";
const sourceContractAcceptancePath = "src/capabilities/ai-input-gateway/acceptance/web-chat-source-contract.acceptance-helper.ts";
const realChromeParallelAcceptancePath = "src/capabilities/ai-input-gateway/acceptance/web-chat-parallel.real-chrome.ts";
const realChromeRestartAcceptancePath = "src/capabilities/ai-input-gateway/acceptance/web-chat-restart-recovery.real-chrome.ts";
const removedUploadPath = "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts";
const removedAcceptancePath = "scripts/acceptance/ai-input-gateway-ordered-upload.acceptance.ts";
const removedSerialLeasePath = "src/capabilities/ai-input-gateway/runtime/web-chat-provider-lease.ts";
const removedSerialAcceptancePath = "scripts/acceptance/ai-input-gateway-provider-lease.acceptance.ts";

const governedPaths = [schemaPath, contractPath, adapterContractPath, childPath, sharedPath, orderedTransportPath, nativeTransportPath, attachmentTransportPath, composerScriptsPath, browserContractPath, nativePrimitivePath, chromeWindowControlPath, chromeBrowserPrimitivesPath, acceptancePath, concurrencyLeasePath, schedulerLedgerPath, executionStatePath, systemChatTitlePath, responseCheckpointPath, singleTabBrowserPath, singleProviderTabPath, feedProviderPath, managedExecutionPath, failureClassificationPath, turnIdentityPath, chatTitlePath, chatTitleScriptsPath, responseCapturePath, answerEvaluationPath, answerSupportPath, resumePath, rateLimitDialogPath, recoveryPath, historyCleanupPath, singleTabRoutingPath, namedConversationSearchPath, concurrencyAcceptancePath, transientPatrolAcceptancePath, sourceContractAcceptancePath, realChromeParallelAcceptancePath, realChromeRestartAcceptancePath] as const;

const pushFinding = (findings: Finding[], lawId: string, filePath: string, checkId: string, message: string): void => {
  findings.push(createFinding({ lawId, filePath, checkId, message }));
};

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined => context.project.getSourceFile(resolveFromRepo(repoPath));

const requireSourceFile = (context: InspectorContext, findings: Finding[], lawId: string, repoPath: string): SourceFile | null => {
  const source = sourceFile(context, repoPath);
  if (source) return source;
  pushFinding(findings, lawId, repoPath, "ai-input-gateway/source-present", `${repoPath} must exist in the audit project.`);
  return null;
};

const identifiers = (source: SourceFile): Set<string> => new Set(source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));

const stringLiterals = (source: SourceFile): Set<string> => new Set([...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()), ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText())]);

const literalVocabulary = (source: SourceFile): Set<string> => {
  const separators = new Set([
    " ", "\n", "\r", "\t", "_", "-", ".", ":", ";", ",", "(", ")", "[", "]",
    "{", "}", "'", '"', "`", "/", "\\", "|", "=", "+", "*", "?", "!",
  ]);
  const words: string[] = [];
  for (const literal of stringLiterals(source)) {
    let current = "";
    for (const character of literal.toLowerCase()) {
      if (!separators.has(character)) {
        current += character;
        continue;
      }
      if (current) words.push(current);
      current = "";
    }
    if (current) words.push(current);
  }
  return new Set(words);
};

const propertyNames = (node: Node): Set<string> => new Set(node.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()));

const typePropertyNames = (source: SourceFile, typeName: string): Set<string> => {
  const alias = source.getTypeAlias(typeName);
  return new Set(
    alias
      ?.getTypeNode()
      ?.getDescendantsOfKind(SyntaxKind.PropertySignature)
      .map((property) => property.getName()) ?? [],
  );
};

const inspectPublicBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const schema = requireSourceFile(context, findings, lawId, schemaPath);
  const contract = requireSourceFile(context, findings, lawId, contractPath);
  if (!schema || !contract) return;
  const inputInitializer = schema.getVariableDeclaration("AiFeedInputSchema")?.getInitializer();
  const publicInputProperties = inputInitializer ? propertyNames(inputInitializer) : new Set<string>();
  const executeOptionProperties = typePropertyNames(contract, "AiInputGatewayExecuteOptions");
  for (const forbidden of ["transportKind", "selector", "coordinate", "tabId", "nativePicker", "fallback"]) {
    if (publicInputProperties.has(forbidden) || executeOptionProperties.has(forbidden)) {
      pushFinding(findings, lawId, schemaPath, "ai-input-gateway/no-public-transport-controls", `Public request/options must not expose ${forbidden}.`);
    }
  }
  if (!executeOptionProperties.has("onAttachmentUploadCompleted")) {
    pushFinding(findings, lawId, contractPath, "ai-input-gateway/aggregate-progress-callback", "Execute options must expose only the aggregate attachment terminal callback.");
  }
  for (const required of ["taskIdentity", "AiTaskLabelKeySchema"]) {
    if (!identifiers(schema).has(required)) {
      pushFinding(findings, lawId, schemaPath, "ai-input-gateway/structured-task-identity", `AI feed schema must declare ${required}.`);
    }
  }
};

const inspectAttachmentChild = (context: InspectorContext, findings: Finding[], routingLawId: string, proofLawId: string): void => {
  const child = requireSourceFile(context, findings, routingLawId, childPath);
  const shared = requireSourceFile(context, findings, routingLawId, sharedPath);
  const adapterContract = requireSourceFile(context, findings, proofLawId, adapterContractPath);
  if (!child || !shared || !adapterContract) return;
  const childIds = identifiers(child);
  const childStrings = stringLiterals(child);
  for (const requiredIdentifier of ["attachApprovedWebChatFilesOnce", "resolveWebChatAttachmentTransportKind", "stageApprovedFiles", "waitForStableAttachmentSet", "stagingManifestHash", "onAttachmentUploadCompleted"]) {
    if (!childIds.has(requiredIdentifier)) {
      pushFinding(findings, proofLawId, childPath, "ai-input-gateway/attachment-child-structure", `${childPath} must contain ${requiredIdentifier}.`);
    }
  }
  for (const requiredLiteral of ["skipped", "ordered_clipboard", "native_picker_batch", "attachments_stable"]) {
    if (!childStrings.has(requiredLiteral)) {
      pushFinding(findings, routingLawId, childPath, "ai-input-gateway/fixed-routing-literal", `${childPath} must declare ${requiredLiteral}.`);
    }
  }
  const forbiddenImports = child
    .getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.includes("web-chat-submit") || specifier.includes("web-chat-answer"));
  for (const specifier of forbiddenImports) {
    pushFinding(findings, routingLawId, childPath, "ai-input-gateway/attachment-child-terminal-boundary", `Attachment child must not import ${specifier}.`);
  }
  if (!identifiers(shared).has("attachApprovedWebChatFilesOnce")) {
    pushFinding(findings, routingLawId, sharedPath, "ai-input-gateway/shared-child-integration", "The web-chat main flow must delegate attachments to the standard child.");
  }
  const proofProperties = typePropertyNames(adapterContract, "WebChatAttachmentUploadProof");
  for (const field of ["uploadAttemptId", "transportKind", "expectedFileCount", "detectedFileCount", "stagingManifestHash", "files", "startedAt", "endedAt", "status", "failureReason", "reviewRequiredReason"]) {
    if (!proofProperties.has(field)) {
      pushFinding(findings, proofLawId, adapterContractPath, "ai-input-gateway/aggregate-proof-field", `Aggregate attachment proof must contain ${field}.`);
    }
  }
};

const inspectNativePrimitive = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const primitive = requireSourceFile(context, findings, lawId, nativePrimitivePath);
  const browserContract = requireSourceFile(context, findings, lawId, browserContractPath);
  if (!primitive || !browserContract) return;
  if (!identifiers(browserContract).has("selectFilesInNativePicker")) {
    pushFinding(findings, lawId, browserContractPath, "ai-input-gateway/browser-native-picker-contract", "BrowserController must expose the generic native multi-file picker primitive.");
  }
  const vocabulary = literalVocabulary(primitive);
  for (const forbiddenWord of ["chatgpt", "gemini", "seo", "bazi", "qimen", "八字", "奇门"]) {
    if (vocabulary.has(forbiddenWord)) {
      pushFinding(findings, lawId, nativePrimitivePath, "ai-input-gateway/generic-browser-primitive", `Generic native picker primitive must not contain ${forbiddenWord}.`);
    }
  }
  for (const requiredIdentifier of ["expectedFileNames", "stagingDirectoryPath", "observedFileNames"]) {
    if (!identifiers(primitive).has(requiredIdentifier)) {
      pushFinding(findings, lawId, nativePrimitivePath, "ai-input-gateway/native-picker-proof", `Native picker primitive must contain ${requiredIdentifier}.`);
    }
  }
};

const inspectRemovedRegion = (findings: Finding[], lawId: string): void => {
  for (const removedPath of [removedUploadPath, removedAcceptancePath, removedSerialLeasePath, removedSerialAcceptancePath]) {
    if (existsSync(resolveFromRepo(removedPath))) {
      pushFinding(findings, lawId, removedPath, "ai-input-gateway/removed-old-region", `${removedPath} must remain deleted.`);
    }
  }
};

const requireParallelSources = (context: InspectorContext, findings: Finding[], lawId: string): SourceFile[] | null => {
  const sources = [concurrencyLeasePath, executionStatePath, singleTabBrowserPath, singleProviderTabPath, feedProviderPath, managedExecutionPath, turnIdentityPath, concurrencyAcceptancePath, realChromeParallelAcceptancePath, chatTitlePath].map((repoPath) => requireSourceFile(context, findings, lawId, repoPath));
  return sources.every((source): source is SourceFile => source !== null) ? sources : null;
};

const inspectParallelIdentifiers = (sources: readonly SourceFile[], findings: Finding[], lawId: string): void => {
  const allIdentifiers = new Set(sources.flatMap((source) => [...identifiers(source)]));
  for (const required of ["resolveWebChatMaxInFlight", "acquireWebChatCapacityLease", "acquireWebChatBrowserMutationLease", "startOrResumeWebChatExecution", "createSingleTabWebChatBrowser", "focusSingleProviderTab", "renameSubmittedChatGptConversation", "captureWebChatSubmissionProof", "turnMarker", "systemChatTitle", "executionId", "capacitySlot"]) {
    if (!allIdentifiers.has(required)) {
      pushFinding(findings, lawId, concurrencyLeasePath, "ai-input-gateway/bounded-parallel-runtime", `Bounded parallel web-chat runtime must contain ${required}.`);
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
      pushFinding(findings, lawId, concurrencyAcceptancePath, "ai-input-gateway/parallel-acceptance", `Concurrency acceptance must prove ${proof.label}.`);
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
      pushFinding(findings, lawId, realChromeParallelAcceptancePath, "ai-input-gateway/parallel-acceptance", `Real Chrome concurrency acceptance must prove ${proof.label}.`);
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
      repoPath: rateLimitDialogPath,
      symbolName: "acknowledgeChatGptRateLimitDialogIfVisible",
    },
    {
      repoPath: recoveryPath,
      symbolName: "recoverPick3NoResultConversation",
    },
    {
      repoPath: historyCleanupPath,
      symbolName: "verifyHistoryDeleted",
    },
    {
      repoPath: singleTabRoutingPath,
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
  for (const repoPath of [rateLimitDialogPath, recoveryPath, singleTabRoutingPath]) {
    const source = requireSourceFile(context, findings, lawId, repoPath);
    if (source && stringLiterals(source).has("rate_limit_ack_clicked_and_same_tab_refreshed")) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/no-chatgpt-page-refresh", `${repoPath} must not retain the removed acknowledgement-and-refresh status.`);
    }
  }
};

const inspectCompletedConversationRename = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const shared = requireSourceFile(context, findings, lawId, sharedPath);
  const chatTitle = requireSourceFile(context, findings, lawId, chatTitlePath);
  const chatTitleScripts = requireSourceFile(context, findings, lawId, chatTitleScriptsPath);
  const adapterContract = requireSourceFile(context, findings, lawId, adapterContractPath);
  const singleTabBrowser = requireSourceFile(context, findings, lawId, singleTabBrowserPath);
  const managedExecution = requireSourceFile(context, findings, lawId, managedExecutionPath);
  if (!shared || !chatTitle || !chatTitleScripts || !adapterContract || !singleTabBrowser || !managedExecution) return;
  const submitFlow = shared.getVariableDeclaration("executeWebChatConversation")?.getInitializer();
  const completedFlow = shared.getVariableDeclaration("buildCompletedWebChatResponse")?.getInitializer();
  const hasRenameCall = (node: Node | undefined): boolean => Boolean(node?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => call.getExpression().getText() === "renameSubmittedChatGptConversation"));
  if (hasRenameCall(submitFlow)) {
    pushFinding(findings, lawId, sharedPath, "ai-input-gateway/deferred-completed-chat-rename", "Submission must release the browser mutation lane before the provider answer exposes its rename menu.");
  }
  if (!hasRenameCall(completedFlow)) {
    pushFinding(findings, lawId, sharedPath, "ai-input-gateway/deferred-completed-chat-rename", "A completed ChatGPT response must finish exact row-scoped rename before publication.");
  }
  const titleStrings = stringLiterals(chatTitleScripts);
  for (const required of ["^/c/(?!WEB:)[^/?#]+(?:[?#].*)?$", "li"]) {
    if (!titleStrings.has(required)) {
      pushFinding(findings, lawId, chatTitleScriptsPath, "ai-input-gateway/exact-sidebar-row-rename", `ChatGPT rename targeting must declare the exact string literal ${required}.`);
    }
  }
  if (identifiers(chatTitleScripts).has("depth")) {
    pushFinding(findings, lawId, chatTitleScriptsPath, "ai-input-gateway/exact-sidebar-row-rename", "ChatGPT rename targeting must not climb into the page-header conversation menu.");
  }
  for (const [repoPath, source] of [
    [adapterContractPath, adapterContract],
    [singleTabBrowserPath, singleTabBrowser],
    [managedExecutionPath, managedExecution],
    [chatTitlePath, chatTitle],
  ] as const) {
    if (!identifiers(source).has("runExclusivePatrol")) {
      pushFinding(findings, lawId, repoPath, "ai-input-gateway/atomic-completed-chat-rename", `${repoPath} must wire runExclusivePatrol for one non-interleavable rename transaction.`);
    }
  }
  if (!stringLiterals(chatTitle).has("WEB_CHAT_RENAME_NOT_READY")) {
    pushFinding(findings, lawId, chatTitlePath, "ai-input-gateway/retryable-completed-chat-rename", "Transient ChatGPT rename UI must remain retryable without discarding the captured answer.");
  }
};

const inspectHumanReadableSystemChatTitle = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const executionState = requireSourceFile(context, findings, lawId, executionStatePath);
  const systemTitle = requireSourceFile(context, findings, lawId, systemChatTitlePath);
  const acceptance = requireSourceFile(context, findings, lawId, concurrencyAcceptancePath);
  if (!executionState || !systemTitle || !acceptance) return;
  if (!identifiers(executionState).has("buildHumanReadableSystemChatTitle")) {
    pushFinding(findings, lawId, executionStatePath, "ai-input-gateway/human-readable-system-chat-title", "New GPT executions must use the single human-readable system chat title builder.");
  }
  const systemTitleStrings = stringLiterals(systemTitle);
  for (const required of ["SEO资料研究", "AI任务", "｜"]) {
    if (!systemTitleStrings.has(required)) {
      pushFinding(findings, lawId, systemChatTitlePath, "ai-input-gateway/human-readable-system-chat-title", `System chat title builder must declare ${required}.`);
    }
  }
  if (
    identifiers(systemTitle).has("textPrompt")
    || [...systemTitleStrings].some((literal) => literal.startsWith("GRASSEYE-"))
  ) {
    pushFinding(findings, lawId, systemChatTitlePath, "ai-input-gateway/human-readable-system-chat-title", "System chat titles must not copy prompt text or retain the legacy machine-only title prefix.");
  }
  const acceptanceIdentifiers = identifiers(acceptance);
  for (const required of ["buildHumanReadableSystemChatTitle", "seoTitle"]) {
    if (!acceptanceIdentifiers.has(required)) {
      pushFinding(findings, lawId, concurrencyAcceptancePath, "ai-input-gateway/human-readable-system-chat-title", `Concurrency acceptance must execute ${required}.`);
    }
  }
  const acceptanceStrings = stringLiterals(acceptance);
  for (const required of ["seo_research", "bazi_analysis", "generic_ai"]) {
    if (!acceptanceStrings.has(required)) {
      pushFinding(findings, lawId, concurrencyAcceptancePath, "ai-input-gateway/human-readable-system-chat-title", `Concurrency acceptance must cover ${required}.`);
    }
  }
};

const inspectSharedRateLimitWatcher = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const watcher = requireSourceFile(context, findings, lawId, rateLimitDialogPath);
  const managed = requireSourceFile(context, findings, lawId, managedExecutionPath);
  const singleTab = requireSourceFile(context, findings, lawId, singleTabBrowserPath);
  if (!watcher || !managed || !singleTab) return;
  if (
    !identifiers(watcher).has("sharedAcknowledgementWatchers")
    || !identifiers(watcher).has("refCount")
    || !identifiers(managed).has("globalBrowser")
    || !identifiers(singleTab).has("globalBrowser")
  ) {
    pushFinding(findings, lawId, rateLimitDialogPath, "ai-input-gateway/shared-rate-limit-watcher", "The single physical ChatGPT tab must use one shared unrouted acknowledgement watcher.");
  }
};

const inspectLiveGenerationProof = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const evaluation = requireSourceFile(context, findings, lawId, answerEvaluationPath);
  const acceptance = requireSourceFile(context, findings, lawId, sourceContractAcceptancePath);
  if (!evaluation || !acceptance) return;
  const acceptanceIds = identifiers(acceptance);
  const acceptanceText = stringLiterals(acceptance);
  if (
    !evaluation.getVariableDeclaration("WEB_CHAT_STATUS_TEXT_SCRIPT")
    || !acceptanceIds.has("answerEvaluation")
    || !acceptanceText.has("visibleProgressClass")
    || !acceptanceText.has("[class*='shimmer']")
  ) {
    pushFinding(findings, lawId, answerEvaluationPath, "ai-input-gateway/live-generation-proof", "Live loading/shimmer DOM must remain generating until the exact answer completes.");
  }
};

const inspectTransientPatrolRetry = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const answer = requireSourceFile(context, findings, lawId, answerSupportPath);
  const capture = requireSourceFile(context, findings, lawId, responseCapturePath);
  const routing = requireSourceFile(context, findings, lawId, singleTabRoutingPath);
  const acceptance = requireSourceFile(context, findings, lawId, transientPatrolAcceptancePath);
  if (!answer || !capture || !routing || !acceptance) return;
  if (
    !identifiers(answer).has("isTransientNavigationExtractionError")
    || !identifiers(capture).has("webChatExecution")
    || !identifiers(routing).has("focusUnrenamedChatGptConversation")
    || !identifiers(acceptance).has("assertTransientPatrolRemainsRetryable")
    || !stringLiterals(acceptance).has("WEB_CHAT_BOUND_CONVERSATION_NOT_READY: exact submitted ChatGPT sidebar row is not ready for marker verification")
  ) {
    pushFinding(findings, lawId, answerSupportPath, "ai-input-gateway/live-generation-proof", "A submitted sidebar row that is not yet focusable must remain retryable across response preflight and before-poll routing.");
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const publicLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-001-V1");
  const routingLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-003-V1");
  const proofLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-004-V1");
  const parallelLawId = selectLawId(context.planEntry.lawIds, "APEX-AI-INPUT-GATEWAY-005-V1");
  const findings: Finding[] = [];
  for (const authorityPath of [lawPath, blueprintPath]) {
    if (!existsSync(resolveFromRepo(authorityPath))) {
      pushFinding(findings, publicLawId, authorityPath, "ai-input-gateway/authority-present", `${authorityPath} must exist.`);
    }
  }
  for (const repoPath of governedPaths) {
    requireSourceFile(context, findings, publicLawId, repoPath);
  }
  inspectPublicBoundary(context, findings, publicLawId);
  inspectAttachmentChild(context, findings, routingLawId, proofLawId);
  inspectNativePrimitive(context, findings, routingLawId);
  inspectRemovedRegion(findings, routingLawId);
  inspectBoundedParallelExecution(context, findings, parallelLawId);
  inspectNoChatGptPageRefresh(context, findings, parallelLawId);
  inspectCompletedConversationRename(context, findings, parallelLawId);
  inspectHumanReadableSystemChatTitle(context, findings, parallelLawId);
  findings.push(...inspectAiInputGatewayRecovery(context, parallelLawId));
  inspectSubmissionPriorityPatrol(context, findings, parallelLawId);
  inspectSharedRateLimitWatcher(context, findings, parallelLawId);
  inspectLiveGenerationProof(context, findings, parallelLawId);
  inspectTransientPatrolRetry(context, findings, parallelLawId);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [lawPath, blueprintPath, ...governedPaths].sort(),
    reportJson: {
      capabilityDomain: context.planEntry.capabilityDomain,
      status: findings.length === 0 ? "PASS" : "FAIL",
      findings,
    },
  };
};
