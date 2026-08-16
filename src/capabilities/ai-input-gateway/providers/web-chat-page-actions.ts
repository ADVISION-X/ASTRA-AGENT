import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { waitForExactAttachmentCount as waitForExactAttachmentCountImpl } from "./web-chat-upload-page-actions.js";
import {
  CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
  FOCUS_COMPOSER_SCRIPT,
  VERIFY_COMPOSER_FOCUSED_SCRIPT,
} from "./web-chat-composer-scripts.js";
import { acknowledgeChatGptRateLimitDialogIfVisible } from "./web-chat-rate-limit-dialog.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;

export const focusComposer = (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluate<WebChatEvaluation>({
    description: "focus AI web chat composer for file paste",
    script: FOCUS_COMPOSER_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const verifyComposerFocused = (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluate<WebChatEvaluation>({
    description: "verify AI web chat composer focus",
    script: VERIFY_COMPOSER_FOCUSED_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const waitForExactAttachmentCount = (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  timeoutMs: number,
  options: {
    expectedPageUrl?: string | null;
    baselineAttachmentCount?: number;
    requireReady?: boolean;
    requireComposerTextEmpty?: boolean;
  } = {},
): Promise<WebChatEvaluation> => waitForExactAttachmentCountImpl(
  browser,
  context,
  expectedCount,
  expectedFileNames,
  Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS),
  options,
);

export const waitForComposerFocused = async (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + Math.min(timeoutMs, 5_000);
  let lastMessage = "provider input focus was not checked";
  while (Date.now() < deadline) {
    await acknowledgeChatGptRateLimitDialogIfVisible({ browser, context });
    const focusEvaluation = await focusComposer(browser, context);
    lastMessage = `${focusEvaluation.status}: ${focusEvaluation.message}`;
    if (focusEvaluation.status === "review_required" || focusEvaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await browser.wait(100);
    const evaluation = await verifyComposerFocused(browser, context);
    lastMessage = `${evaluation.status}: ${evaluation.message}`;
    if (evaluation.status === "success") return;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await browser.wait(100);
  }
  throw new Error(`pending: provider input box focus did not stick; last=${lastMessage}`);
};

export const clickChatGptSendButton = (
  browser: BrowserTargetSession,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluate<WebChatEvaluation>({
    description: "click ChatGPT send button for pasted text card",
    script: CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
