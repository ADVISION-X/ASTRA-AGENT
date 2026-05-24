import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  waitForAttachmentCountAtLeast as waitForAttachmentCountAtLeastImpl,
} from "./web-chat-upload-page-actions.js";
import {
  CHATGPT_PASTED_TEXT_CARD_READY_SCRIPT,
  CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
  FOCUS_COMPOSER_SCRIPT,
  VERIFY_COMPOSER_FOCUSED_SCRIPT,
} from "./web-chat-composer-scripts.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 15_000;

export const focusComposer = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "focus AI web chat composer for file paste",
    script: FOCUS_COMPOSER_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const verifyComposerFocused = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat composer focus",
    script: VERIFY_COMPOSER_FOCUSED_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const waitForAttachmentCountAtLeast = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  timeoutMs: number,
): Promise<WebChatEvaluation> => waitForAttachmentCountAtLeastImpl(
  browser,
  context,
  expectedCount,
  Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS),
);

export const waitForComposerFocused = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + Math.min(timeoutMs, 2_000);
  let lastMessage = "provider input focus was not checked";
  while (Date.now() < deadline) {
    const evaluation = await verifyComposerFocused(browser, context);
    lastMessage = `${evaluation.status}: ${evaluation.message}`;
    if (evaluation.status === "success") return;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await browser.wait(100);
  }
  throw new Error(`review_required: provider input did not keep focus; last=${lastMessage}`);
};

const readChatGptPastedTextCard = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "detect ChatGPT pasted text composer card",
    script: CHATGPT_PASTED_TEXT_CARD_READY_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const waitForChatGptPastedTextCardReady = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  timeoutMs: number,
): Promise<WebChatEvaluation | null> => {
  const deadline = Date.now() + Math.min(timeoutMs, 8_000);
  while (Date.now() < deadline) {
    const evaluation = await readChatGptPastedTextCard(browser, context);
    if (evaluation.status === "success") return evaluation;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(`${evaluation.status}: ${evaluation.message}`);
    }
    await browser.wait(250);
  }
  return null;
};

export const clickChatGptSendButton = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "click ChatGPT send button for pasted text card",
    script: CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
