import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildFindUploadTargetScript,
  buildSetComposerTextScript,
  buildWaitForUploadScript,
  buildVerifyComposerTextScript,
  buildVerifyPromptSubmittedScript,
  FOCUS_COMPOSER_SCRIPT,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";
import {
  CLEAR_COMPOSER_SCRIPT,
  CLICK_SUBMIT_BUTTON_SCRIPT,
  FIND_COMPOSER_POINT_SCRIPT,
  FIND_SUBMIT_BUTTON_POINT_SCRIPT,
  FIND_UPLOAD_MENU_POINT_SCRIPT,
} from "./web-chat-page-action-scripts.js";

const POLL_INTERVAL_MS = 1500;

const locateUploadTarget = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "locate web chat file input",
    script: buildFindUploadTargetScript(),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

const waitForUpload = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  fileName: string,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "wait for web chat file upload completion",
    script: buildWaitForUploadScript(fileName),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const focusComposer = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "focus AI web chat composer for file paste",
    script: FOCUS_COMPOSER_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const clearComposer = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "clear stale AI web chat draft and attachments",
    script: CLEAR_COMPOSER_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const findUploadMenuPoint = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "locate AI web chat upload menu point",
    script: FIND_UPLOAD_MENU_POINT_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const findComposerPoint = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "locate AI web chat composer point",
    script: FIND_COMPOSER_POINT_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const clickSubmitButton = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "click AI web chat submit button",
    script: CLICK_SUBMIT_BUTTON_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const findSubmitButtonPoint = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "locate AI web chat submit button point",
    script: FIND_SUBMIT_BUTTON_POINT_SCRIPT,
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const setComposerText = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  text: string,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "set AI web chat composer prompt text",
    script: buildSetComposerTextScript(text),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const verifyComposerText = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedText: string,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat composer prompt text",
    script: buildVerifyComposerTextScript(expectedText),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const verifyPromptSubmitted = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedText: string,
  previousAssistantCount: number,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "verify AI web chat prompt was submitted",
    script: buildVerifyPromptSubmittedScript(expectedText, previousAssistantCount),
    ...(context.abortSignal ? { abortSignal: context.abortSignal } : {}),
  });

export const assertUploadTarget = (evaluation: WebChatEvaluation): string => {
  if (evaluation.status === "success" && evaluation.selector) {
    return evaluation.selector;
  }
  throw new Error(`${evaluation.status}: ${evaluation.message}`);
};

export const waitForUploadTarget = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  timeoutMs: number,
): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + Math.min(timeoutMs, 30_000);
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    const evaluation = await locateUploadTarget(browser, context);
    if (evaluation.status === "success" || evaluation.status === "review_required" || evaluation.status === "failed") {
      return evaluation;
    }
    lastEvaluation = evaluation;
    await browser.wait(POLL_INTERVAL_MS);
  }
  return lastEvaluation ?? {
    status: "review_required",
    message: "provider file input not found",
    pageUrl: browser.getSessionState().currentUrl,
    selector: null,
  };
};

export const waitForUploadComplete = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  filePath: string,
  timeoutMs: number,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const fileName = filePath.split("/").pop() ?? filePath;
  while (Date.now() < deadline) {
    const evaluation = await waitForUpload(browser, context, fileName);
    if (evaluation.status === "success") {
      return;
    }
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(`${evaluation.status}: ${evaluation.message}`);
    }
    await browser.wait(POLL_INTERVAL_MS);
  }
  throw new Error(`review_required: provider upload timed out for ${fileName}.`);
};
