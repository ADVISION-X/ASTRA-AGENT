import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatForkActionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  cleanupStaleWorkspaceConversationTabs,
  recordWorkspaceConversationUrl,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

export const readActivePageUrl = async (
  browser: BrowserTargetLease,
): Promise<string | null> => {
  try {
    const state = await browser.evaluate<{ pageUrl: string }>({
      description: "read active page URL before AI web chat feed",
      script: "return {pageUrl: location.href};",
    });
    return state.pageUrl || null;
  } catch {
    return browser.getLeaseState().currentUrl || null;
  }
};

export const assertActiveProviderPage = async (input: {
  browser: BrowserTargetLease;
  providerUrl: string;
  abortSignal?: AbortSignal;
  phase: string;
}): Promise<void> => {
  const expectedHost = new URL(input.providerUrl).host;
  const readState = (): Promise<{ pageUrl: string; hostMatches: boolean }> =>
    input.browser.evaluate<{ pageUrl: string; hostMatches: boolean }>({
      description: `verify provider page remains active before ${input.phase}`,
      script: `const expectedHost=${JSON.stringify(expectedHost)};return {pageUrl:location.href,hostMatches:location.host===expectedHost};`,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  let state = await readState();
  if (!state.hostMatches && input.phase === "attachment upload"
    && state.pageUrl.startsWith("chrome-error://")) {
    const reopened = await input.browser.open({
      url: input.providerUrl,
      title: "recover provider page before attachment upload",
      reusePolicy: "bind-existing-exact-origin",
    });
    if (reopened.ok) {
      await input.browser.wait(1_000);
      state = await readState();
    }
  }
  if (!state.hostMatches) {
    throw new Error(
      `review_required: active Chrome tab left provider page before ${input.phase}; pageUrl=${state.pageUrl}`,
    );
  }
};

export const requireBrowser = (context: AiProviderAdapterContext): BrowserTargetLease => {
  if (!context.browser) throw new Error("Web chat feed requires a governed BrowserTargetLease.");
  return context.browser;
};

const continuationVerified = (input: {
  request: AiFeedInput;
  providerUrl: string;
  extracted: WebChatEvaluation;
}): boolean | null => {
  if (!input.request.providerContinuationRef) return null;
  const requested = new URL(input.request.providerContinuationRef.providerPageUrl);
  const actual = new URL(input.extracted.pageUrl ?? input.providerUrl);
  return requested.origin === actual.origin && requested.pathname === actual.pathname;
};

const normalizedForkProof = (input: {
  forkActionProof?: AiProviderRawResponse["forkActionProof"];
  submissionProof?: AiProviderRawResponse["submissionProof"];
}): WebChatForkActionProof | null => {
  if (!input.forkActionProof) return null;
  if (input.submissionProof
    && input.submissionProof.transientConversationUrl
      !== input.forkActionProof.childConversationUrl) {
    throw new Error("review_required: CHATGPT_FORK_CHILD_CONVERSATION_DRIFT_BEFORE_SUBMISSION");
  }
  const submittedUrl = input.submissionProof?.canonicalConversationUrl
    ?? input.submissionProof?.transientConversationUrl;
  return submittedUrl
    ? { ...input.forkActionProof, childConversationUrl: submittedUrl }
    : input.forkActionProof;
};

const providerTabPolicy = (
  request: AiFeedInput,
  managedParallelExecution: boolean | undefined,
): Exclude<AiProviderRawResponse["providerTabPolicy"], undefined> =>
  managedParallelExecution
    ? "single-controlled-tab-canonical-route-polling"
    : resolveWebChatWorkspaceId(request)
      ? "reuse-single-provider-workspace-tab"
      : "provider-default-tab-policy";

export const buildWebChatRawResponse = (input: {
  request: AiFeedInput;
  runtimeName: string;
  providerUrl: string;
  sourcePageUrlBeforeFeed: string | null;
  extracted: WebChatEvaluation;
  answerText: string;
  modelIdentityProof?: AiProviderRawResponse["modelIdentityProof"];
  providerExecutionProfileProof?: AiProviderRawResponse["providerExecutionProfileProof"];
  conversationTitleProof?: AiProviderRawResponse["conversationTitleProof"];
  providerTranscriptJsonl?: string | null;
  providerTranscriptHash?: `sha256:${string}` | null;
  uploadedFiles?: AiProviderUploadedFileProof[];
  attachmentUploadProof?: WebChatAttachmentUploadProof;
  outputRefs?: string[];
  outputArtifacts?: AiProviderRawResponse["outputArtifacts"];
  managedParallelExecution?: boolean;
  forkActionProof?: AiProviderRawResponse["forkActionProof"];
  submissionProof?: AiProviderRawResponse["submissionProof"];
}): AiProviderRawResponse => ({
  webChatWorkspaceId: resolveWebChatWorkspaceId(input.request),
  providerTabPolicy: providerTabPolicy(input.request, input.managedParallelExecution),
  providerRecoveryAttemptCount: null,
  providerRecoveryStatus: null,
  staleConversationCleanupStatus: null,
  staleConversationHistoryCleanupStatus: null,
  rawText: input.answerText,
  modelName:
    input.request.providerExecutionProfile?.modelDisplayName
    ?? input.request.modelName,
  modelIdentityProof: input.modelIdentityProof ?? null,
  providerExecutionProfileProof: input.providerExecutionProfileProof ?? null,
  conversationTitleProof: input.conversationTitleProof ?? null,
  providerTranscriptJsonl: input.providerTranscriptJsonl ?? null,
  providerTranscriptHash: input.providerTranscriptHash ?? null,
  runtimeName: input.runtimeName,
  transport: "web-chat",
  webChatUrl: input.extracted.pageUrl ?? input.providerUrl,
  continuationActualUrl: input.request.providerContinuationRef
    ? input.extracted.pageUrl ?? input.providerUrl : null,
  continuationVerified: continuationVerified(input),
  forkActionProof: normalizedForkProof(input),
  submissionProof: input.submissionProof ?? null,
  sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
  restoredSourcePage: null,
  uploadedFiles: input.uploadedFiles ?? [],
  ...(input.attachmentUploadProof
    ? { attachmentUploadProof: input.attachmentUploadProof } : {}),
  outputRefs: input.outputRefs ?? [],
  outputArtifacts: input.outputArtifacts ?? [],
  estimatedInputTokens: null,
  estimatedOutputTokens: null,
  tokenEstimateUnavailableReason: "web chat token estimates are unavailable.",
});

export const persistWorkspaceAfterResponse = (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  response: AiProviderRawResponse;
}): void => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  saveWorkspaceUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    url: input.response.webChatUrl,
  });
  recordWorkspaceConversationUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    url: input.response.webChatUrl,
  });
};

export const cleanupProviderWorkspaceAfterResponse = async (input: {
  browser: BrowserTargetLease;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  response: AiProviderRawResponse;
}): Promise<void> => {
  if (input.context.webChatExecution) {
    input.response.staleConversationHistoryCleanupStatus = "not_needed_governed_conversation_retained";
    input.response.staleConversationCleanupStatus = "not_needed_single_controlled_tab";
    return;
  }
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  input.response.staleConversationHistoryCleanupStatus =
    `provider_history_delete_temporarily_disabled:${input.request.providerKind}`;
  input.response.staleConversationCleanupStatus = await cleanupStaleWorkspaceConversationTabs({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    keepRecentCount: 2,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};
