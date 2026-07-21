import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import {
  type WebChatEvaluation,
} from "./web-chat-evaluation.js";
import {
  buildWaitForAttachmentCountScript,
  buildWaitForExactAttachmentCountScript,
} from "./web-chat-composer-scripts.js";
import {
  CLEAR_COMPOSER_SCRIPT,
} from "./web-chat-page-action-scripts.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 15_000;

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

const checkExactAttachmentCount = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "wait for exact web chat attachment count",
    script: buildWaitForExactAttachmentCountScript(expectedCount, expectedFileNames),
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

export const waitForExactAttachmentCount = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  timeoutMs: number,
): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS);
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    const evaluation = await checkExactAttachmentCount(browser, context, expectedCount, expectedFileNames);
    lastEvaluation = evaluation;
    if (evaluation.status === "success") return evaluation;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(`${evaluation.message}; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(evaluation.attachmentCount ?? 0)}; expected_files=${expectedFileNames.join("|")}; detected_files=${evaluation.attachmentNames?.join("|") ?? ""}`);
    }
    await browser.wait(250);
  }
  throw new Error(
    `GPT_ATTACHMENT_COUNT_MISMATCH; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(lastEvaluation?.attachmentCount ?? 0)}; expected_files=${expectedFileNames.join("|")}; detected_files=${lastEvaluation?.attachmentNames?.join("|") ?? ""}; scope=${lastEvaluation?.attachmentScope ?? "none"}.`,
  );
};
