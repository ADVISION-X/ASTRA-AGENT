import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
const CHATGPT_ASSISTANT_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='assistant']";

type FreshConversationInput = Readonly<{
  browser: BrowserTargetLease;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  providerUrl: string;
  required: boolean;
  waitForProviderComposer: () => Promise<void>;
  isRecoverableComposerTimeout: (error: unknown) => boolean;
  emitStage: (input: {
    stage: string;
    status: "start" | "success" | "failed";
    startedAtMs: number | null;
    refs?: Record<string, string | number | boolean | null | undefined>;
  }) => void;
}>;

const count = async (browser: BrowserTargetLease, selector: string): Promise<number> => {
  const value = await browser.executeDomIntent({ kind: "find", selector, maxMatches: 20 });
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || typeof (value as { count?: unknown }).count !== "number") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return (value as { count: number }).count;
};

const isExactFreshChatGptRoot = async (browser: BrowserTargetLease): Promise<boolean> => {
  const [document, composer, userCount, assistantCount] = await Promise.all([
    browser.executeDomIntent({ kind: "document" }),
    browser.executeDomIntent({
      kind: "inspect",
      selector: CHATGPT_COMPOSER_SELECTOR,
      fields: ["tagName", "visible", "disabled", "text"],
    }),
    count(browser, CHATGPT_USER_TURN_SELECTOR),
    count(browser, CHATGPT_ASSISTANT_TURN_SELECTOR),
  ]);
  if (typeof document !== "object" || document === null || Array.isArray(document)
    || typeof (document as { url?: unknown }).url !== "string"
    || typeof composer !== "object" || composer === null || Array.isArray(composer)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const url = new URL((document as { url: string }).url);
  const state = composer as Record<string, unknown>;
  return url.origin === "https://chatgpt.com"
    && (url.pathname === "/" || url.pathname === "")
    && state.tagName === "DIV"
    && state.visible === true
    && state.disabled !== true
    && typeof state.text === "string"
    && state.text.trim().length === 0
    && userCount === 0
    && assistantCount === 0;
};

/** A new chat is an exact root navigation, never a guessed sidebar click. */
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
    await input.browser.navigate({ url: "https://chatgpt.com/", title: "fresh governed ChatGPT conversation" });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (input.context.abortSignal?.aborted) throw new Error("review_required: ChatGPT fresh conversation wait aborted");
      if (await isExactFreshChatGptRoot(input.browser)) {
        await input.waitForProviderComposer();
        input.emitStage({ stage: "fresh_chatgpt_conversation", status: "success", startedAtMs, refs: { exactRoot: true } });
        return;
      }
      await input.browser.wait({ durationMs: 250 });
    }
    throw new Error("review_required: ChatGPT root did not reach the exact empty fresh-conversation state");
  } catch (error) {
    input.emitStage({ stage: "fresh_chatgpt_conversation", status: "failed", startedAtMs, refs: { reason: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
};
