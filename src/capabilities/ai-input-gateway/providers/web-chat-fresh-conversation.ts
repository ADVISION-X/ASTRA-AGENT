import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_CURRENT_PAGE_SCOPE = "main";

type FreshConversationInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
  required: boolean;
  emitStage: (input: {
    stage: string;
    status: "start" | "success" | "failed";
    startedAtMs: number | null;
    refs?: Record<string, string | number | boolean | null | undefined>;
  }) => void;
}>;

const inspectFreshComposer = async (browser: BrowserTargetLease): Promise<Record<string, unknown>> => {
  const value = await browser.executeDomIntent({
    kind: "inspect",
    selector: CHATGPT_COMPOSER_SELECTOR,
    fields: ["tagName", "visible", "disabled", "text"],
    scope: { selector: CHATGPT_CURRENT_PAGE_SCOPE },
  });
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const readDocumentUrl = async (browser: BrowserTargetLease): Promise<string> => {
  const document = await browser.executeDomIntent({ kind: "document" });
  const documentState = typeof document === "object" && document !== null && !Array.isArray(document)
    ? document as Record<string, unknown>
    : null;
  if (!documentState || typeof documentState.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return documentState.url;
};

const isFreshComposer = (state: Record<string, unknown>): boolean => state.tagName === "DIV"
  && state.visible === true
  && state.disabled !== true
  && typeof state.text === "string"
  && state.text.trim().length === 0;

const isChatGptRootUrl = (value: string): boolean => {
  const url = new URL(value);
  return url.origin === "https://chatgpt.com" && (url.pathname === "/" || url.pathname === "");
};

/** A new chat is an exact-root proof; an already-clean root is a no-op. */
export const startFreshChatGptConversation = async (
  input: FreshConversationInput,
): Promise<void> => {
  if (!input.required) return;
  const provider = new URL(input.providerUrl);
  if (input.request.providerKind !== "gpt-web-chat" || provider.origin !== "https://chatgpt.com") {
    throw new Error("review_required: NOT_PRODUCTION_VERIFIED: fresh conversation is only evidenced for ChatGPT");
  }
  const startedAtMs = Date.now();
  input.emitStage({ stage: "fresh_chatgpt_conversation", status: "start", startedAtMs: null, refs: { timeoutMs: 30_000 } });
  try {
    if (!isChatGptRootUrl(await readDocumentUrl(input.browser))) {
      await input.browser.navigate({ url: "https://chatgpt.com/", title: "fresh governed ChatGPT conversation" });
      await input.browser.wait({ durationMs: 250 });
    }
    const deadline = Date.now() + 30_000;
    let lastTransientObservationFailure: string | null = null;
    while (Date.now() < deadline) {
      if (input.context.abortSignal?.aborted) throw new Error("review_required: ChatGPT fresh conversation wait aborted");
      try {
        if (isFreshComposer(await inspectFreshComposer(input.browser))) {
          input.emitStage({ stage: "fresh_chatgpt_conversation", status: "success", startedAtMs, refs: { exactRoot: true } });
          return;
        }
        lastTransientObservationFailure = null;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "BROWSER_TARGET_INVALID") throw error;
        lastTransientObservationFailure = error.message;
      }
      await input.browser.wait({ durationMs: 250 });
    }
    if (lastTransientObservationFailure) {
      throw new Error("WEB_CHAT_FRESH_CONVERSATION_HYDRATION_PENDING: BROWSER_TARGET_INVALID");
    }
    throw new Error("review_required: ChatGPT root did not reach the exact empty fresh-conversation state");
  } catch (error) {
    input.emitStage({ stage: "fresh_chatgpt_conversation", status: "failed", startedAtMs, refs: { reason: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
};
