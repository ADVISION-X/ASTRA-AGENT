export const attachment = {
  schemaPath: "src/capabilities/ai-input-gateway/schema.ts",
  contractPath: "src/capabilities/ai-input-gateway/contract.ts",
  adapterContractPath: "src/capabilities/ai-input-gateway/contracts/ai-provider-adapter.contract.ts",
  childPath: "src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts",
  sharedPath: "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
  exactTargetTransportPath: "src/capabilities/ai-input-gateway/providers/web-chat-exact-target-file-input-attachment.ts",
  attachmentTransportPath: "src/capabilities/ai-input-gateway/providers/web-chat-attachment-transport.ts",
  attachmentStatePath: "src/capabilities/ai-input-gateway/providers/web-chat-upload-page-actions.ts",
  submittedAttachmentStatePath: "src/capabilities/ai-input-gateway/providers/web-chat-submit-page-actions.ts",
  browserContractPath: "src/lib/browser/browser-authority-api.ts",
  exactTargetRefPath: "src/lib/browser/exact-target/browser-target-ref.ts",
  exactTargetRuntimePath: "src/lib/browser/exact-target/browser-command-actor.ts",
  acceptancePath: "src/capabilities/ai-input-gateway/acceptance/attachment.acceptance.ts",
} as const;

const runtimeCoordination = {
  concurrencyLeasePath: "src/capabilities/ai-input-gateway/runtime/web-chat-concurrency-lease.ts",
  schedulerLedgerPath: "src/capabilities/ai-input-gateway/runtime/web-chat-scheduler-ledger.ts",
  responseCheckpointPath: "src/capabilities/ai-input-gateway/runtime/web-chat-response-checkpoint.ts",
  checkpointResponsePath: "src/capabilities/ai-input-gateway/providers/web-chat-checkpoint-response.ts",
  singleTabBrowserPath: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-browser.ts",
  feedProviderPath: "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
  failureClassificationPath: "src/capabilities/ai-input-gateway/failure-classification.ts",
  turnIdentityPath: "src/capabilities/ai-input-gateway/providers/web-chat-turn-identity.ts",
  openPath: "src/capabilities/ai-input-gateway/providers/web-chat-open.ts",
  forkPath: "src/capabilities/ai-input-gateway/providers/web-chat-fork.ts",
  providerProofPath: "src/capabilities/ai-input-gateway/runtime/ai-feed-proof.ts",
} as const;

const runtimeConversation = {
  freshConversationControlPath: "src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation.ts",
  responseCapturePath: "src/capabilities/ai-input-gateway/providers/web-chat-response-capture.ts",
  answerSupportPath: "src/capabilities/ai-input-gateway/providers/web-chat-answer-support.ts",
  resumePath: "src/capabilities/ai-input-gateway/providers/web-chat-resume.ts",
  rateLimitDialogPath: "src/capabilities/ai-input-gateway/providers/web-chat-rate-limit-dialog.ts",
  recoveryPath: "src/capabilities/ai-input-gateway/providers/web-chat-recovery.ts",
} as const;

const runtimeInteraction = {
  singleTabRoutingPath: "src/capabilities/ai-input-gateway/runtime/web-chat-single-tab-routing.ts",
  searchDialogHygienePath: "src/capabilities/ai-input-gateway/providers/web-chat-search-dialog-hygiene.ts",
  submitPath: "src/capabilities/ai-input-gateway/providers/web-chat-submit.ts",
  generatedImageCapturePath: "src/capabilities/ai-input-gateway/providers/web-chat-generated-image-capture.ts",
} as const;

export const sessionControl = {
  providerExecutionProfilePath: "src/capabilities/ai-input-gateway/provider-execution-profile.ts",
  gptExecutionProfilePath: "src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts",
  sessionControllerPath: "src/capabilities/ai-input-gateway/providers/web-chat-session-controller.ts",
  pageActionContractPath: "src/capabilities/ai-input-gateway/providers/web-chat-page-action-contract.ts",
  conversationTitlePolicyPath: "src/capabilities/ai-input-gateway/runtime/web-chat-conversation-title-policy.ts",
  conversationTitlePath: "src/capabilities/ai-input-gateway/providers/gpt-web-conversation-title.ts",
  conversationDiscoveryPath: "src/capabilities/ai-input-gateway/providers/gpt-web-conversation-discovery.ts",
} as const;

export const runtime = {
  ...runtimeCoordination,
  ...runtimeConversation,
  ...runtimeInteraction,
} as const;

export const executionRuntime = {
  executionStatePath: "src/capabilities/ai-input-gateway/runtime/web-chat-execution-state.ts",
  canonicalBindingPath: "src/capabilities/ai-input-gateway/runtime/web-chat-canonical-binding.ts",
  managedExecutionPath: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution.ts",
  managedExecutionStartPath: "src/capabilities/ai-input-gateway/runtime/web-chat-managed-execution-start.ts",
} as const;

export const acceptance = {
  concurrencyAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-concurrency.acceptance.ts",
  identityRecoveryAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-identity-recovery.acceptance-helper.ts",
  recoveryAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-recovery.acceptance-helper.ts",
  transientPatrolAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-transient-patrol.acceptance-helper.ts",
  sourceContractAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-source-contract.acceptance-helper.ts",
} as const;

export const serialBrowserActionPaths = [
  runtime.freshConversationControlPath,
  attachment.attachmentStatePath,
  attachment.submittedAttachmentStatePath,
  runtime.resumePath,
] as const;

export const removed = {
  removedProviderInputPreflightPath: "src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-input-preflight.ts",
  removedProviderInputPreflightAcceptancePath: "scripts/acceptance/xuanxue-ai-production-provider-preflight.ts",
  removedUploadPath: "src/capabilities/ai-input-gateway/providers/web-chat-upload.ts",
  removedAcceptancePath: "scripts/acceptance/ai-input-gateway-ordered-upload.acceptance.ts",
  removedSerialLeasePath: "src/capabilities/ai-input-gateway/runtime/web-chat-provider-lease.ts",
  removedSerialAcceptancePath: "scripts/acceptance/ai-input-gateway-provider-lease.acceptance.ts",
  removedLegacyModelIdentityPath: "src/capabilities/ai-input-gateway/providers/web-chat-model-identity.ts",
  removedChatTitlePath: "src/capabilities/ai-input-gateway/providers/web-chat-chat-title.ts",
  removedChatTitleScriptsPath: "src/capabilities/ai-input-gateway/providers/web-chat-chat-title-scripts.ts",
  removedSystemTitlePath: "src/capabilities/ai-input-gateway/runtime/web-chat-system-title.ts",
  removedTitleHousekeepingPath: "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping.ts",
  removedTitleHousekeepingWorkerPath: "src/capabilities/ai-input-gateway/runtime/web-chat-title-housekeeping-worker.ts",
  removedNamedConversationSearchPath: "src/capabilities/ai-input-gateway/runtime/web-chat-named-conversation-search.ts",
  removedRenameAcceptancePath: "src/capabilities/ai-input-gateway/acceptance/web-chat-rename-patrol.acceptance-helper.ts",
} as const;

export const governedPaths = [
  ...Object.values(attachment),
  ...Object.values(runtime),
  ...Object.values(sessionControl),
  ...Object.values(executionRuntime),
  ...Object.values(acceptance),
] as const;
