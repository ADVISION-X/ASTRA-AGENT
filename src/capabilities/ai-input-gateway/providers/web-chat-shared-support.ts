import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  cleanupStaleWorkspaceConversationTabs,
  focusExistingSourceTab,
  recordWorkspaceConversationUrl,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";
import { cleanupStaleWorkspaceConversationHistory, GEMINI_STALE_CLEANUP_MAX_PER_RUN } from "./web-chat-pick3-history-cleanup.js";

export const restoreSourcePage = async (
  browser: BrowserController,
  sourceUrl: string | null,
  abortSignal?: AbortSignal,
): Promise<boolean | null> => {
  if (!sourceUrl || sourceUrl === "about:blank") return null;
  const focused = await focusExistingSourceTab({ sourceUrl, ...(abortSignal ? { abortSignal } : {}) });
  if (!focused) {
    const reopened = await browser.open({
      url: sourceUrl,
      title: "restore source page after AI feed",
      reusePolicy: "reuse-active-tab",
      ...(abortSignal ? { abortSignal } : {}),
    });
    if (!reopened.ok) return false;
    await browser.wait(500);
  }
  const parsed = new URL(sourceUrl);
  const parsedSource = parsed.protocol === "blob:"
    ? (() => {
        try {
          return new URL(parsed.pathname);
        } catch {
          return parsed;
        }
      })()
    : parsed;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const restoredState = await browser.evaluateActiveTab<{ pageUrl: string; sourceMatches: boolean }>({
        description: "verify source page restored after AI feed",
        script: `
const expectedUrl = ${JSON.stringify(sourceUrl)};
const expectedHost = ${JSON.stringify(parsedSource.host)};
const expectedOrigin = ${JSON.stringify(parsedSource.origin)};
return {
  pageUrl: location.href,
  sourceMatches: location.href === expectedUrl || location.host === expectedHost || location.origin === expectedOrigin,
};
`,
      });
      if (restoredState.sourceMatches) return true;
    } catch {
      // The AppleScript tab focus and the active-tab DOM probe are asynchronous.
      // Retry within the same restoration attempt; failure still fails closed below.
    }
    if (attempt < 4) await browser.wait(500);
  }
  return false;
};

export const readActivePageUrl = async (
  browser: BrowserController,
): Promise<string | null> => {
  try {
    const state = await browser.evaluateActiveTab<{ pageUrl: string }>({
      description: "read active page URL before AI web chat feed",
      script: "return {pageUrl: location.href};",
    });
    return state.pageUrl || null;
  } catch {
    return browser.getSessionState().currentUrl || null;
  }
};

export const assertActiveProviderPage = async (input: {
  browser: BrowserController;
  providerUrl: string;
  abortSignal?: AbortSignal;
  phase: string;
}): Promise<void> => {
  const expectedHost = new URL(input.providerUrl).host;
  const readState = (): Promise<{ pageUrl: string; hostMatches: boolean }> =>
    input.browser.evaluateActiveTab<{ pageUrl: string; hostMatches: boolean }>({
      description: `verify provider page remains active before ${input.phase}`,
      script: `
const expectedHost = ${JSON.stringify(expectedHost)};
return {pageUrl: location.href, hostMatches: location.host === expectedHost};
`,
      ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
    });
  let state = await readState();
  if (!state.hostMatches && input.phase === "attachment upload" && state.pageUrl.startsWith("chrome-error://")) {
    const reopened = await input.browser.open({
      url: input.providerUrl,
      title: "recover provider page before attachment upload",
      reusePolicy: "reuse-active-tab",
    });
    if (reopened.ok) {
      await input.browser.wait(1_000);
      state = await readState();
    }
  }
  if (!state.hostMatches) {
    throw new Error(`review_required: active Chrome tab left provider page before ${input.phase}; pageUrl=${state.pageUrl}`);
  }
};

export const requireBrowser = (context: AiProviderAdapterContext): BrowserController => {
  if (!context.browser) {
    throw new Error("Web chat feed requires a governed BrowserController.");
  }
  return context.browser;
};

export const buildWebChatRawResponse = (input: {
  request: AiFeedInput;
  runtimeName: string;
  providerUrl: string;
  sourcePageUrlBeforeFeed: string | null;
  extracted: WebChatEvaluation;
  answerText: string;
  uploadedFiles?: AiProviderUploadedFileProof[];
  attachmentUploadProof?: WebChatAttachmentUploadProof;
  outputRefs?: string[];
}): AiProviderRawResponse => ({
  webChatWorkspaceId: resolveWebChatWorkspaceId(input.request),
  providerTabPolicy: resolveWebChatWorkspaceId(input.request)
    ? "reuse-single-provider-workspace-tab"
    : "provider-default-tab-policy",
  providerRecoveryAttemptCount: null,
  providerRecoveryStatus: null,
  staleConversationCleanupStatus: null,
  staleConversationHistoryCleanupStatus: null,
  rawText: input.answerText,
  modelName: input.request.modelName,
  runtimeName: input.runtimeName,
  transport: "web-chat",
  webChatUrl: input.extracted.pageUrl ?? input.providerUrl,
  continuationActualUrl: input.request.providerContinuationRef ? input.extracted.pageUrl ?? input.providerUrl : null,
  continuationVerified: input.request.providerContinuationRef
    ? (() => {
        const requested = new URL(input.request.providerContinuationRef.providerPageUrl);
        const actual = new URL(input.extracted.pageUrl ?? input.providerUrl);
        return requested.origin === actual.origin && requested.pathname === actual.pathname;
      })()
    : null,
  sourcePageUrlBeforeFeed: input.sourcePageUrlBeforeFeed,
  restoredSourcePage: null,
  uploadedFiles: input.uploadedFiles ?? [],
  ...(input.attachmentUploadProof ? { attachmentUploadProof: input.attachmentUploadProof } : {}),
  outputRefs: input.outputRefs ?? [],
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

export const cleanupGeminiPick3HistoryBeforeNextImage = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
}): Promise<string | null> => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return null;
  if (
    input.request.providerKind !== "gemini-web-chat"
    || !input.request.promptContractId.startsWith("pick3-is-blind-eval")
  ) {
    return null;
  }
  return cleanupStaleWorkspaceConversationHistory({
    browser: input.browser,
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    keepRecentCount: 1,
    triggerThreshold: 1,
    maxDeleteCount: GEMINI_STALE_CLEANUP_MAX_PER_RUN,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};

export const isBlockingGeminiPick3PreImageHistoryCleanupStatus = (status: string | null): boolean =>
  status !== null
  && (
    /failed_[1-9]\d*/.test(status)
    || status.includes("cleanup_failed")
    || status.includes("verify_failed")
  );

export const cleanupProviderWorkspaceAfterResponse = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  response: AiProviderRawResponse;
}): Promise<void> => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  if (!workspaceId) return;
  if (
    input.request.providerKind === "gemini-web-chat"
    && input.request.promptContractId.startsWith("pick3-is-blind-eval")
  ) {
    input.response.staleConversationHistoryCleanupStatus = "deferred_gemini_pick3_post_batch_cleanup_required";
    input.response.staleConversationCleanupStatus = "deferred_gemini_pick3_post_batch_cleanup_required";
    return;
  }
  input.response.staleConversationHistoryCleanupStatus = await cleanupStaleWorkspaceConversationHistory({
    browser: input.browser,
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    keepRecentCount: 2,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  input.response.staleConversationCleanupStatus = await cleanupStaleWorkspaceConversationTabs({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId,
    keepRecentCount: 2,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};
