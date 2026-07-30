export const authority = {
  lawPath:
    ".github/instructions/agent-rules/modules/module-ai-input-gateway.instructions.md",
  blueprintPath:
    "docs/法案辅助文件/GrassEye AI 投喂能立组施工图 V1.md",
} as const;

export const attachment = {
  schemaPath: "src/capabilities/ai-input-gateway/schema.ts",
  contractPath: "src/capabilities/ai-input-gateway/contract.ts",
  adapterContractPath:
    "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts",
  childPath:
    "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts",
  sharedPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  orderedTransportPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-ordered-clipboard-attachment.ts",
  nativeTransportPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-native-picker-attachment.ts",
  attachmentTransportPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-attachment-transport.ts",
  composerScriptsPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts",
  browserContractPath: "src/lib/browser/browser-controller.ts",
  nativePrimitivePath:
    "src/lib/browser/current-chrome-native-multi-file-picker.ts",
  chromeWindowControlPath:
    "src/lib/browser/current-chrome-window-control.ts",
  chromeAccessibilityWindowPath:
    "src/lib/browser/current-chrome-accessibility-window.ts",
  chromeBrowserPrimitivesPath:
    "src/lib/browser/current-chrome-browser-controller-primitives.ts",
  chromeBrowserExecutionPath:
    "src/lib/browser/current-chrome-browser-controller-execution.ts",
  acceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts",
  attachmentNativePickerAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/attachment-native-picker-contract.acceptance-helper.ts",
} as const;

export const runtime = {
  concurrencyLeasePath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-concurrency-lease.ts",
  schedulerLedgerPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-scheduler-ledger.ts",
  responseCheckpointPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-response-checkpoint.ts",
  checkpointResponsePath:
    "src/capabilities/ai-input-gateway/providers/web-chat-checkpoint-response.ts",
  singleTabBrowserPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  singleProviderTabPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-single-provider-tab.ts",
  feedProviderPath:
    "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  failureClassificationPath:
    "src/capabilities/ai-input-gateway/failure-classification.ts",
  turnIdentityPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-turn-identity.ts",
  openPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
  freshConversationPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation-script.ts",
  submissionCheckpointPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-submission-checkpoint.ts",
  chatTitlePath:
    "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  chatTitleScriptsPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
  titleHousekeepingPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
  titleHousekeepingWorkerPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping-worker.ts",
  responseCapturePath:
    "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts",
  answerEvaluationPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-evaluation.ts",
  answerSupportPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  resumePath:
    "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts",
  rateLimitDialogPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts",
  recoveryPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-recovery.ts",
  historyCleanupPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-pick3-history-cleanup.ts",
  singleTabRoutingPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  namedConversationSearchPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-named-conversation-search.ts",
  searchDialogHygienePath:
    "src/capabilities/ai-input-gateway/providers/web-chat-search-dialog-hygiene.ts",
  pageActionsPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-page-actions.ts",
  submitPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
} as const;

export const executionRuntime = {
  executionStatePath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  continuationTitlePath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-continuation-title.ts",
  systemChatTitlePath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-system-title.ts",
  managedExecutionPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  managedExecutionStartPath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution-start.ts",
} as const;

export const acceptance = {
  concurrencyAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts",
  identityRecoveryAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-identity-recovery.acceptance-helper.ts",
  transientPatrolAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-transient-patrol.acceptance-helper.ts",
  sourceContractAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-source-contract.acceptance-helper.ts",
  realChromeParallelAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-parallel.real-chrome.ts",
  realChromeRestartAcceptancePath:
    "src/capabilities/ai-input-gateway/acceptance/web-chat-restart-recovery.real-chrome.ts",
} as const;

export const removed = {
  removedUploadPath:
    "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts",
  removedAcceptancePath:
    "scripts/acceptance/ai-input-gateway-ordered-upload.acceptance.ts",
  removedSerialLeasePath:
    "src/capabilities/ai-input-gateway/runtime/web-chat-provider-lease.ts",
  removedSerialAcceptancePath:
    "scripts/acceptance/ai-input-gateway-provider-lease.acceptance.ts",
} as const;

export const governedPaths = [
  ...Object.values(attachment),
  ...Object.values(runtime),
  ...Object.values(executionRuntime),
  ...Object.values(acceptance),
] as const;
