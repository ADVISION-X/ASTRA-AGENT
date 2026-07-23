import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import { waitForExactAttachmentCount as waitForExactAttachmentCountImpl } from "./web-chat-upload-page-actions.js";
import {
  CLICK_CHATGPT_ADD_BUTTON_SCRIPT,
  CLICK_CHATGPT_LOCAL_FILE_MENU_ITEM_SCRIPT,
  CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
  FOCUS_COMPOSER_SCRIPT,
  VERIFY_COMPOSER_FOCUSED_SCRIPT,
} from "./web-chat-composer-scripts.js";
import { acknowledgeChatGptRateLimitDialogIfVisible } from "./web-chat-rate-limit-dialog.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;

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

export const waitForExactAttachmentCount = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  timeoutMs: number,
): Promise<WebChatEvaluation> => waitForExactAttachmentCountImpl(
  browser,
  context,
  expectedCount,
  expectedFileNames,
  Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS),
);

export const waitForComposerFocused = async (
  browser: BrowserController,
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
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "click ChatGPT send button for pasted text card",
    script: CLICK_CHATGPT_SEND_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const openChatGptNativeFilePicker = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<void> => {
  const addButton = await browser.evaluateActiveTab<WebChatEvaluation>({
    description: "open ChatGPT attachment menu",
    script: CLICK_CHATGPT_ADD_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });
  if (addButton.status !== "success") {
    throw new Error(`review_required: ${addButton.message}`);
  }
  const deadline = Date.now() + 10_000;
  let lastMessage = "attachment menu was not checked";
  while (Date.now() < deadline) {
    const menuItem = await browser.evaluateActiveTab<WebChatEvaluation & {
      targetPoint?: { x: number; y: number };
    }>({
      description: "choose ChatGPT local file upload action",
      script: CLICK_CHATGPT_LOCAL_FILE_MENU_ITEM_SCRIPT,
      ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
    });
    lastMessage = menuItem.message;
    if (menuItem.status === "success") {
      if (!menuItem.targetPoint) {
        throw new Error("review_required: CHATGPT_LOCAL_FILE_MENU_ITEM_POINT_MISSING");
      }
      const clicked = await browser.click({
        targetLabel: "uniquely located ChatGPT local file upload menu item",
        point: menuItem.targetPoint,
        coordinateSpace: "browserViewport",
        button: "left",
        clickCount: 1,
      });
      if (!clicked.ok) {
        throw new Error(`review_required: CHATGPT_LOCAL_FILE_MENU_ITEM_REAL_CLICK_FAILED; ${clicked.message}`);
      }
      return;
    }
    if (menuItem.status === "review_required" || menuItem.status === "failed") {
      throw new Error(`review_required: ${menuItem.message}`);
    }
    await browser.wait(150);
  }
  throw new Error(`review_required: CHATGPT_LOCAL_FILE_MENU_ITEM_NOT_READY; last=${lastMessage}`);
};
