import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { openGovernedContinuation } from "./web-chat-continuation.js";
import { CHATGPT_FRESH_CONVERSATION_SCRIPT } from "./web-chat-fresh-conversation-script.js";
import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";
import {
  focusExistingWorkspaceTab,
  isPick3WorkspaceId,
  readSavedWorkspaceUrl,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

const PROVIDER_COMPOSER_READY_TIMEOUT_MS = 60_000;
const AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX = "amazon-product-mining-" as const;

const PROVIDER_COMPOSER_READY_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const composer = resolveComposerInput();
return {status: composer ? "success" : "pending", message: composer ? "provider composer ready" : "provider composer pending", pageUrl: location.href};
`;

const isChromeAppleEventsJavaScriptDisabled = (message: string): boolean =>
  (message.includes("AppleScript") && message.includes("JavaScript") && message.includes("关闭"))
  || message.includes("Allow JavaScript from Apple Events")
  || message.includes("允许 Apple 事件中的 JavaScript");

const emitWebChatOpenStage = (input: {
  request: AiFeedInput;
  stage: string;
  status: string;
  startedAtMs: number | null;
  refs?: Record<string, unknown>;
}): void => {
  if (!isPick3WebChatRequest({ request: input.request })) return;
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    marker: "[GRASSEYE][AI-GATEWAY][WEB-CHAT]",
    providerKind: input.request.providerKind,
    stage: input.stage,
    status: input.status,
    ...(input.startedAtMs === null ? {} : { elapsedMs: Date.now() - input.startedAtMs }),
    refs: {
      promptPackageId: input.request.promptPackageId,
      inputRefId: input.request.inputRefs[0]?.id ?? null,
      ...input.refs,
    },
  })}\n`);
};

const CHATGPT_NEW_CHAT_SCRIPT = `
const candidates = Array.from(document.querySelectorAll('a,button,[role="link"],[role="button"]'));
const target = candidates.find((element) => {
  const label = [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
    .filter(Boolean)
    .join(" ")
    .replace(/\\s+/gu, " ")
    .trim();
  return label.includes("新聊天") || label.toLowerCase().includes("new chat");
});
if (!target) {
  return {status: "review_required", message: "ChatGPT new chat control was not found", pageUrl: location.href, candidateCount: candidates.length};
}
target.click();
return {status: "success", message: "clicked ChatGPT new chat", pageUrl: location.href};
`;

export const isDeepResearchGptRequest = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  new URL(input.providerUrl).host === "chatgpt.com"
  && input.request.promptContractId.includes("deep-research.");

export const isAmazonProductMiningGptRequest = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  new URL(input.providerUrl).host === "chatgpt.com"
  && input.request.promptContractId.startsWith(AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX);

export const isPick3GptRequest = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  new URL(input.providerUrl).host === "chatgpt.com"
  && input.request.promptContractId.includes("pick3-is-blind-eval");

export const isPick3GeminiRequest = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  new URL(input.providerUrl).host === "gemini.google.com"
  && input.request.providerKind === "gemini-web-chat"
  && input.request.promptContractId.includes("pick3-is-blind-eval");

export const isPick3WebChatRequest = (input: {
  request: AiFeedInput;
}): boolean =>
  (input.request.providerKind === "gpt-web-chat" || input.request.providerKind === "gemini-web-chat")
  && input.request.promptContractId.includes("pick3-is-blind-eval");

const requiresFreshChatGptConversation = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  !input.request.providerContinuationRef && (
  (new URL(input.providerUrl).host === "chatgpt.com" && input.request.providerKind === "gpt-web-chat")
  || isDeepResearchGptRequest(input)
  || isAmazonProductMiningGptRequest(input)
  || isPick3GptRequest(input)
  || isPick3GeminiRequest(input));

const resolveProviderReusePolicy = (input: {
  providerUrl: string;
  request: AiFeedInput;
  workspaceId: string | null;
}): "reuse-exact-url" | "open-new-tab" | "reuse-host-tab" =>
  // All provider workspaces stay in one host tab. Fresh GPT conversations are
  // created in-place by startFreshChatGptConversation; opening a tab per run
  // causes uncontrolled Chrome tab growth and leaves stale provider pages.
  "reuse-host-tab";

const waitForProviderComposer = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  abortSignal?: AbortSignal;
}): Promise<void> => {
  const startedAtMs = Date.now();
  const deadline = Date.now() + PROVIDER_COMPOSER_READY_TIMEOUT_MS;
  let lastMessage = "provider composer readiness was not checked";
  emitWebChatOpenStage({
    request: input.request,
    stage: "provider_composer_ready",
    status: "start",
    startedAtMs: null,
    refs: { timeoutMs: PROVIDER_COMPOSER_READY_TIMEOUT_MS },
  });
  while (Date.now() < deadline) {
    if (input.abortSignal?.aborted) {
      throw new Error("review_required: provider composer wait aborted.");
    }
    let state: WebChatEvaluation | null = null;
    try {
      state = await input.browser.evaluateActiveTab<WebChatEvaluation>({
        description: "wait for provider web chat composer",
        script: PROVIDER_COMPOSER_READY_SCRIPT,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
      if (isChromeAppleEventsJavaScriptDisabled(lastMessage)) {
        throw new Error(`review_required: Chrome Apple Events JavaScript is disabled; enable Google Chrome menu 显示/开发者/允许 Apple 事件中的 JavaScript before using web-chat provider. last=${lastMessage}`);
      }
      emitWebChatOpenStage({
        request: input.request,
        stage: "provider_composer_ready_probe",
        status: "fallback",
        startedAtMs,
        refs: { reason: lastMessage },
      });
      await input.browser.wait(1_000);
      continue;
    }
    lastMessage = `${state.status}: ${state.message}; pageUrl=${state.pageUrl ?? "unknown"}`;
    if (state.status === "success") {
      emitWebChatOpenStage({
        request: input.request,
        stage: "provider_composer_ready",
        status: "success",
        startedAtMs,
      });
      return;
    }
    if (state.status === "review_required" || state.status === "failed") {
      throw new Error(`${state.status}: ${state.message}`);
    }
    await input.browser.wait(300);
  }
  emitWebChatOpenStage({
    request: input.request,
    stage: "provider_composer_ready",
    status: "failed",
    startedAtMs,
    refs: { reason: lastMessage },
  });
  throw new Error(`review_required: provider composer did not become ready; last=${lastMessage}`);
};

const isRecoverableComposerTimeout = (error: unknown): boolean =>
  error instanceof Error
  && /provider composer did not become ready|wait for provider web chat composer.*timed out/iu.test(error.message);

const isTransientProviderEvaluationTimeout = (error: unknown): boolean =>
  error instanceof Error
  && /active-tab evaluation.*timed out/iu.test(error.message);

const waitForFreshChatGptConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  abortSignal?: AbortSignal;
}): Promise<void> => {
  const startedAtMs = Date.now();
  const deadline = Date.now() + 30_000;
  let lastMessage = "ChatGPT fresh conversation was not checked";
  emitWebChatOpenStage({
    request: input.request,
    stage: "fresh_chatgpt_conversation",
    status: "start",
    startedAtMs: null,
    refs: { timeoutMs: 30_000 },
  });
  while (Date.now() < deadline) {
    if (input.abortSignal?.aborted) {
      throw new Error("review_required: ChatGPT fresh conversation wait aborted.");
    }
    try {
      const state = await input.browser.evaluateActiveTab<WebChatEvaluation>({
        description: "verify isolated ChatGPT fresh conversation",
        script: CHATGPT_FRESH_CONVERSATION_SCRIPT,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });
      lastMessage = `${state.status}: ${state.message}; pageUrl=${state.pageUrl ?? "unknown"}`;
      if (state.status === "success") {
        emitWebChatOpenStage({
          request: input.request,
          stage: "fresh_chatgpt_conversation",
          status: "success",
          startedAtMs,
        });
        return;
      }
      if (state.status === "review_required" || state.status === "failed") {
        throw new Error(`${state.status}: ${state.message}`);
      }
    } catch (error) {
      if (!isTransientProviderEvaluationTimeout(error)) throw error;
      lastMessage = error instanceof Error ? error.message : String(error);
    }
    await input.browser.wait(300);
  }
  emitWebChatOpenStage({
    request: input.request,
    stage: "fresh_chatgpt_conversation",
    status: "failed",
    startedAtMs,
    refs: { reason: lastMessage },
  });
  throw new Error(`review_required: ChatGPT fresh conversation was not established; last=${lastMessage}`);
};

type FreshConversationInput = {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
};

const openFreshGeminiConversation = async (input: FreshConversationInput): Promise<void> => {
  const opened = await input.browser.open({
    url: input.providerUrl,
    title: "gemini-web-chat:pick3-is-blind-eval:fresh",
    reusePolicy: "reuse-active-tab",
  });
  assertProviderPageOpened(opened);
  await waitForProviderComposer({
    browser: input.browser,
    request: input.request,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};

const clickChatGptNewConversation = async (input: FreshConversationInput): Promise<void> => {
  const deadline = Date.now() + 30_000;
  let lastState: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    let state: WebChatEvaluation;
    try {
      state = await input.browser.evaluateActiveTab<WebChatEvaluation>({
        description: "click ChatGPT new chat before isolated GPT prompt",
        script: CHATGPT_NEW_CHAT_SCRIPT,
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      });
    } catch (error) {
      if (!isTransientProviderEvaluationTimeout(error)) throw error;
      await input.browser.wait(500);
      continue;
    }
    lastState = state;
    if (state.status === "success") break;
    if (state.status !== "review_required" || !state.message.includes("not found")) {
      throw new Error(`${state.status}: ${state.message}`);
    }
    await input.browser.wait(300);
  }
  if (lastState?.status !== "success") {
    throw new Error(`${lastState?.status ?? "review_required"}: ${lastState?.message ?? "ChatGPT new chat control was not found"}`);
  }
};

const recoverChatGptComposer = async (input: FreshConversationInput): Promise<void> => {
  const reopened = await input.browser.open({
    url: input.providerUrl,
    title: "recover-provider-composer",
    reusePolicy: "reuse-active-tab",
  });
  assertProviderPageOpened(reopened);
  await waitForFreshChatGptConversation({
    browser: input.browser,
    request: input.request,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  await waitForProviderComposer({
    browser: input.browser,
    request: input.request,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};

const startFreshChatGptConversation = async (input: FreshConversationInput): Promise<void> => {
  if (!requiresFreshChatGptConversation(input)) return;
  if (isPick3GeminiRequest(input)) return openFreshGeminiConversation(input);
  await clickChatGptNewConversation(input);
  await waitForFreshChatGptConversation({
    browser: input.browser,
    request: input.request,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  try {
    await waitForProviderComposer({
      browser: input.browser,
      request: input.request,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
  } catch (error) {
    if (!isRecoverableComposerTimeout(error)) throw error;
    await recoverChatGptComposer(input);
  }
};

const readActiveProviderUrl = async (
  browser: BrowserController,
  abortSignal?: AbortSignal,
): Promise<string | null> => {
  try {
    const state = await browser.evaluateActiveTab<{ pageUrl: string | null }>({
      description: "read active provider workspace URL",
      script: "return {pageUrl: location.href};",
      ...(abortSignal ? { abortSignal } : {}),
    });
    return state.pageUrl;
  } catch {
    return browser.getSessionState().currentUrl || null;
  }
};

const resolveWorkspaceState = (input: {
  context: AiProviderAdapterContext;
  request: AiFeedInput;
}): { workspaceId: string | null; savedUrl: string | null } => {
  const workspaceId = resolveWebChatWorkspaceId(input.request);
  const savedUrl = workspaceId
    ? readSavedWorkspaceUrl({
        dataDir: input.context.dataDir,
        providerKind: input.request.providerKind,
        workspaceId,
      })
    : null;
  return { workspaceId, savedUrl };
};

const focusExistingProviderWorkspace = async (input: {
  providerUrl: string;
  context: AiProviderAdapterContext;
  workspaceId: string | null;
  savedUrl: string | null;
}): Promise<boolean> => {
  if (!input.workspaceId) {
    return false;
  }
  return focusExistingWorkspaceTab({
    providerHost: new URL(input.providerUrl).host,
    workspaceId: input.workspaceId,
    savedUrl: input.savedUrl,
    allowAnyProviderTab: isPick3WorkspaceId(input.workspaceId) || input.workspaceId === "full-corpus",
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};

const persistWorkspaceUrlIfNeeded = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  workspaceId: string | null;
}): Promise<void> => {
  if (!input.workspaceId) {
    return;
  }
  saveWorkspaceUrl({
    dataDir: input.context.dataDir,
    providerKind: input.request.providerKind,
    workspaceId: input.workspaceId,
    url: await readActiveProviderUrl(input.browser, input.context.abortSignal),
  });
};

const openOrReuseProviderWorkspace = async (input: {
  browser: BrowserController;
  providerUrl: string;
  runtimeName: string;
  workspaceId: string | null;
  savedUrl: string | null;
  focusedExisting: boolean;
  reusePolicy: "reuse-exact-url" | "open-new-tab" | "reuse-host-tab";
}): Promise<{ ok: boolean; message: string }> => input.focusedExisting
  ? { ok: true, message: "focused existing provider workspace tab" }
  : input.browser.open({
      url: isPick3WorkspaceId(input.workspaceId) ? input.providerUrl : input.savedUrl ?? input.providerUrl,
      title: `${input.runtimeName}${input.workspaceId ? `:${input.workspaceId}` : ""}`,
      reusePolicy: input.reusePolicy,
    });

const assertProviderPageOpened = (opened: { ok: boolean; message: string }): void => {
  if (!opened.ok) {
    throw new Error(`Web chat provider page could not be opened: ${opened.message}`);
  }
};

export const openProviderPage = async (input: {
  browser: BrowserController;
  providerUrl: string;
  runtimeName: string;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
}): Promise<void> => {
  if (input.request.providerContinuationRef) {
    await openGovernedContinuation({
      ...input,
      waitForComposer: () => waitForProviderComposer({
        browser: input.browser,
        request: input.request,
        ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
      }),
    });
    return;
  }
  const { workspaceId, savedUrl } = resolveWorkspaceState(input);
  const reusePolicy = resolveProviderReusePolicy({
    providerUrl: input.providerUrl,
    request: input.request,
    workspaceId,
  });
  const focusedExisting = await focusExistingProviderWorkspace({
    providerUrl: input.providerUrl,
    context: input.context,
    workspaceId,
    savedUrl,
  });
  const opened = await openOrReuseProviderWorkspace({
    browser: input.browser,
    providerUrl: input.providerUrl,
    runtimeName: input.runtimeName,
    workspaceId,
    savedUrl,
    focusedExisting,
    reusePolicy,
  });
  assertProviderPageOpened(opened);
  try {
    await waitForProviderComposer({
      browser: input.browser,
      request: input.request,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
  } catch (error) {
    if (!isRecoverableComposerTimeout(error)) throw error;
    const reopened = await input.browser.open({
      url: input.providerUrl,
      title: `${input.runtimeName}:recover-provider-composer`,
      reusePolicy: "reuse-active-tab",
    });
    assertProviderPageOpened(reopened);
    await input.browser.wait(1_000);
    await waitForProviderComposer({
      browser: input.browser,
      request: input.request,
      ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
    });
  }
  await startFreshChatGptConversation({
    browser: input.browser,
    context: input.context,
    request: input.request,
    providerUrl: input.providerUrl,
  });
  await persistWorkspaceUrlIfNeeded({ browser: input.browser, context: input.context, request: input.request, workspaceId });
};
