import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import { buildWaitForExactAttachmentCountScript } from "./web-chat-composer-scripts.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  CLEAR_COMPOSER_SCRIPT,
} from "./web-chat-page-action-scripts.js";
import { getRecentChatGptBlockingDialog } from "./web-chat-rate-limit-dialog.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;

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
    const blockingDialog = getRecentChatGptBlockingDialog();
    if (blockingDialog) {
      const code = blockingDialog.kind === "rate_limit" ? "GPT_UPLOAD_RATE_LIMITED" : "GPT_UPLOAD_REJECTED";
      throw new Error(`${code}; prompt_submitted=false; response_captured=false; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(evaluation.attachmentCount ?? 0)}; provider_dialog=${blockingDialog.text}`);
    }
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(`${evaluation.message}; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(evaluation.attachmentCount ?? 0)}; expected_files=${expectedFileNames.join("|")}; detected_files=${evaluation.attachmentNames?.join("|") ?? ""}`);
    }
    await browser.wait(250);
  }
  const blockingDialog = getRecentChatGptBlockingDialog();
  if (blockingDialog) {
    const code = blockingDialog.kind === "rate_limit" ? "GPT_UPLOAD_RATE_LIMITED" : "GPT_UPLOAD_REJECTED";
    throw new Error(`${code}; prompt_submitted=false; response_captured=false; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(lastEvaluation?.attachmentCount ?? 0)}; provider_dialog=${blockingDialog.text}`);
  }
  throw new Error(
    `GPT_ATTACHMENT_COUNT_MISMATCH; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(lastEvaluation?.attachmentCount ?? 0)}; expected_files=${expectedFileNames.join("|")}; detected_files=${lastEvaluation?.attachmentNames?.join("|") ?? ""}; scope=${lastEvaluation?.attachmentScope ?? "none"}.`,
  );
};
