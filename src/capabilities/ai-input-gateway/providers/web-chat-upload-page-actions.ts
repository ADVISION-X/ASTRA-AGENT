import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  buildFindUploadTargetScript,
  buildWaitForUploadScript,
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";
import { buildWaitForAttachmentCountScript } from "./web-chat-composer-scripts.js";
import {
  CLEAR_COMPOSER_SCRIPT,
  FIND_UPLOAD_MENU_POINT_SCRIPT,
} from "./web-chat-page-action-scripts.js";

const POLL_INTERVAL_MS = 1500;
const MAX_UPLOAD_COMPLETE_WAIT_MS = 45_000;
const MAX_ATTACHMENT_COUNT_WAIT_MS = 15_000;

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

const checkAttachmentCount = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "wait for web chat attachment count",
    script: buildWaitForAttachmentCountScript(expectedCount),
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
  const deadline = Date.now() + Math.min(timeoutMs, MAX_UPLOAD_COMPLETE_WAIT_MS);
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

export const waitForAttachmentCountAtLeast = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  timeoutMs: number,
): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS);
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    const evaluation = await checkAttachmentCount(browser, context, expectedCount);
    lastEvaluation = evaluation;
    if (evaluation.status === "success") return evaluation;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(`${evaluation.status}: ${evaluation.message}`);
    }
    await browser.wait(250);
  }
  throw new Error(
    `review_required: provider attachment count timed out; expected=${expectedCount}; detected=${String(lastEvaluation?.attachmentCount ?? 0)}; scope=${lastEvaluation?.attachmentScope ?? "none"}.`,
  );
};