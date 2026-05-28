import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import { WEB_CHAT_SELECTOR_SCRIPT_PRELUDE } from "./web-chat-selector-prelude.js";
import { AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX } from "./web-chat-restore-policy.js";
import {
  focusExistingWorkspaceTab,
  readSavedWorkspaceUrl,
  resolveWebChatWorkspaceId,
  saveWorkspaceUrl,
} from "./web-chat-workspace.js";

const PROVIDER_COMPOSER_READY_SCRIPT = `
${WEB_CHAT_SELECTOR_SCRIPT_PRELUDE}
const composer = resolveComposerInput();
return {status: composer ? "success" : "pending", message: composer ? "provider composer ready" : "provider composer pending", pageUrl: location.href};
`;

const CHATGPT_NEW_CHAT_SCRIPT = `
const candidates = Array.from(document.querySelectorAll("a,button"));
const target = candidates.find((element) => {
  const label = [element.getAttribute("aria-label"), element.textContent].filter(Boolean).join(" ");
  return label.includes("新聊天") || label.includes("New chat");
});
if (!target) {
  return {status: "review_required", message: "ChatGPT new chat control was not found", pageUrl: location.href};
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

const requiresFreshChatGptConversation = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): boolean =>
  isDeepResearchGptRequest(input) || isAmazonProductMiningGptRequest(input);

const resolveProviderReusePolicy = (input: {
  providerUrl: string;
  request: AiFeedInput;
}): "reuse-exact-url" | "open-new-tab" =>
  requiresFreshChatGptConversation(input) ? "open-new-tab" : "reuse-exact-url";

const waitForProviderComposer = async (
  browser: BrowserController,
  abortSignal?: AbortSignal,
): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (abortSignal?.aborted) {
      throw new Error("review_required: provider composer wait aborted.");
    }
    const state = await browser.evaluateActiveTab<WebChatEvaluation>({
      description: "wait for provider web chat composer",
      script: PROVIDER_COMPOSER_READY_SCRIPT,
      ...(abortSignal ? { abortSignal } : {}),
    });
    if (state.status === "success") return;
    if (state.status === "review_required" || state.status === "failed") {
      throw new Error(`${state.status}: ${state.message}`);
    }
    await browser.wait(300);
  }
  throw new Error("review_required: provider composer did not become ready.");
};

const startFreshChatGptConversation = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
}): Promise<void> => {
  if (!requiresFreshChatGptConversation(input)) return;
  const state = await input.browser.evaluateActiveTab<WebChatEvaluation>({
    description: "click ChatGPT new chat before isolated GPT prompt",
    script: CHATGPT_NEW_CHAT_SCRIPT,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (state.status !== "success") {
    throw new Error(`${state.status}: ${state.message}`);
  }
  await input.browser.wait(1_000);
  await waitForProviderComposer(input.browser, input.context.abortSignal);
};

const readActiveProviderUrl = async (
  browser: BrowserController,
  abortSignal?: AbortSignal,
): Promise<string | null> => {
  const state = await browser.evaluateActiveTab<{ pageUrl: string | null }>({
    description: "read active provider workspace URL",
    script: "return {pageUrl: location.href};",
    ...(abortSignal ? { abortSignal } : {}),
  });
  return state.pageUrl;
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
    allowAnyProviderTab: false,
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
  reusePolicy: "reuse-exact-url" | "open-new-tab";
}): Promise<{ ok: boolean; message: string }> => input.focusedExisting
  ? { ok: true, message: "focused existing provider workspace tab" }
  : input.browser.open({
    url: input.savedUrl ?? input.providerUrl,
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
  const { workspaceId, savedUrl } = resolveWorkspaceState(input);
  const reusePolicy = resolveProviderReusePolicy({
    providerUrl: input.providerUrl,
    request: input.request,
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
  await waitForProviderComposer(input.browser, input.context.abortSignal);
  await startFreshChatGptConversation({
    browser: input.browser,
    context: input.context,
    request: input.request,
    providerUrl: input.providerUrl,
  });
  await persistWorkspaceUrlIfNeeded({ browser: input.browser, context: input.context, request: input.request, workspaceId });
};
