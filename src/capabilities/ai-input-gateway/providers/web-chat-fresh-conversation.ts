import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";

const CHATGPT_COMPOSER_SELECTOR = "#prompt-textarea";
const CHATGPT_COMPOSER_FORM_SELECTOR = "form";
const CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR = "#upload-files";
const CHATGPT_USER_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='user']";
const CHATGPT_ASSISTANT_TURN_SELECTOR = "[data-testid^='conversation-turn-'][data-turn='assistant']";
const CHATGPT_REMOVE_ATTACHMENT_SELECTOR = "form button[aria-label='Remove file'],form button[aria-label='移除文件'],form button[aria-label='删除文件']";
const CHATGPT_PASTED_TEXT_CARD_SELECTOR = "form [data-testid*='pasted-text' i],form [data-testid*='pasted-content' i]";
const CHATGPT_ACTIVE_GENERATION_SELECTOR = "button[data-testid='stop-button'],button[aria-label='Stop streaming'],button[aria-label='Stop generating'],button[aria-label='停止生成'],button[aria-label='停止回应']";
const CHATGPT_PASTED_TEXT_MARKERS = [
  "已粘贴的文本",
  "在文本字段中显示",
  "pasted text",
  "pasted content",
] as const;

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

const inspect = async (
  browser: BrowserTargetLease,
  selector: string,
  fields: readonly ("tagName" | "type" | "text" | "value" | "accept" | "multiple" | "connected" | "visible" | "disabled")[],
): Promise<Record<string, unknown>> => {
  const value = await browser.executeDomIntent({ kind: "inspect", selector, fields });
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

type FreshRootSnapshot = {
  document: Record<string, unknown>;
  composer: Record<string, unknown>;
  form: Record<string, unknown>;
  fileInput: Record<string, unknown>;
  userCount: number;
  assistantCount: number;
  removeAttachmentCount: number;
  pastedCardCount: number;
  activeGenerationCount: number;
};

const readFreshRootSnapshot = async (browser: BrowserTargetLease): Promise<FreshRootSnapshot> => {
  const [document, composer, formCount, form, fileInput, userCount, assistantCount, removeAttachmentCount, pastedCardCount, activeGenerationCount] = await Promise.all([
    browser.executeDomIntent({ kind: "document" }),
    inspect(browser, CHATGPT_COMPOSER_SELECTOR, ["tagName", "visible", "disabled", "text"]),
    count(browser, CHATGPT_COMPOSER_FORM_SELECTOR),
    inspect(browser, CHATGPT_COMPOSER_FORM_SELECTOR, ["text"]).catch(() => null),
    inspect(browser, CHATGPT_DOCUMENT_FILE_INPUT_SELECTOR, ["tagName", "type", "value", "accept", "multiple", "connected", "visible", "disabled"]),
    count(browser, CHATGPT_USER_TURN_SELECTOR),
    count(browser, CHATGPT_ASSISTANT_TURN_SELECTOR),
    count(browser, CHATGPT_REMOVE_ATTACHMENT_SELECTOR),
    count(browser, CHATGPT_PASTED_TEXT_CARD_SELECTOR),
    count(browser, CHATGPT_ACTIVE_GENERATION_SELECTOR),
  ]);
  if (formCount !== 1 || form === null) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const documentState = typeof document === "object" && document !== null && !Array.isArray(document)
    ? document as Record<string, unknown>
    : null;
  if (!documentState || typeof documentState.url !== "string") throw new Error("BROWSER_TARGET_INVALID");
  return {
    document: documentState,
    composer: inspectRecord(composer),
    form: inspectRecord(form),
    fileInput: inspectRecord(fileInput),
    userCount,
    assistantCount,
    removeAttachmentCount,
    pastedCardCount,
    activeGenerationCount,
  };
};

const inspectRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return value as Record<string, unknown>;
};

const isFreshComposer = (state: Record<string, unknown>): boolean => state.tagName === "DIV"
  && state.visible === true
  && state.disabled !== true
  && typeof state.text === "string"
  && state.text.trim().length === 0;

const isFreshFileInput = (state: Record<string, unknown>): boolean => state.tagName === "INPUT"
  && state.type === "file"
  && state.value === ""
  && state.accept === ""
  && state.multiple === true
  && state.connected === true
  && state.disabled === false;

const isExactFreshChatGptRoot = async (browser: BrowserTargetLease): Promise<boolean> => {
  const snapshot = await readFreshRootSnapshot(browser);
  const url = new URL(String(snapshot.document.url));
  const formText = typeof snapshot.form.text === "string" ? snapshot.form.text.toLocaleLowerCase() : "";
  const hasPastedTextCard = snapshot.pastedCardCount !== 0
    || CHATGPT_PASTED_TEXT_MARKERS.some((marker) => formText.includes(marker));
  const isRootUrl = url.origin === "https://chatgpt.com"
    && (url.pathname === "/" || url.pathname === "")
  return isRootUrl
    && isFreshComposer(snapshot.composer)
    && isFreshFileInput(snapshot.fileInput)
    && snapshot.userCount === 0
    && snapshot.assistantCount === 0
    && snapshot.removeAttachmentCount === 0
    && !hasPastedTextCard
    && snapshot.activeGenerationCount === 0;
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
