import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import { buildWaitForExactAttachmentCountScript } from "./web-chat-composer-scripts.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  CLEAR_COMPOSER_SCRIPT,
} from "./web-chat-page-action-scripts.js";
import { getRecentChatGptBlockingDialog } from "./web-chat-rate-limit-dialog.js";

const MAX_ATTACHMENT_COUNT_WAIT_MS = 120_000;

type ExactAttachmentStateOptions = {
  expectedPageUrl?: string | null;
  baselineAttachmentCount?: number;
  requireReady?: boolean;
  requireComposerTextEmpty?: boolean;
};

export const readExactAttachmentState = (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> =>
  browser.evaluateActiveTab<WebChatEvaluation>({
    description: "read exact fresh web chat composer attachment state",
    script: buildWaitForExactAttachmentCountScript(expectedCount, expectedFileNames, options),
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

const throwIfBlockingDialog = (
  evaluation: WebChatEvaluation | null,
  expectedCount: number,
): void => {
  const blockingDialog = getRecentChatGptBlockingDialog();
  if (!blockingDialog) return;
  const code = blockingDialog.kind === "rate_limit"
    ? "GPT_UPLOAD_RATE_LIMITED"
    : "GPT_UPLOAD_REJECTED";
  throw new Error(
    `${code}; prompt_submitted=false; response_captured=false; step=${expectedCount}; expected_count=${expectedCount}; detected_count=${String(evaluation?.attachmentCount ?? 0)}; provider_dialog=${blockingDialog.text}`,
  );
};

const throwIfTerminalAttachmentEvaluation = (input: {
  evaluation: WebChatEvaluation;
  expectedCount: number;
  expectedFileNames: readonly string[];
}): void => {
  if (input.evaluation.status !== "review_required" && input.evaluation.status !== "failed") return;
  const evaluation = input.evaluation;
  throw new Error(
    `${evaluation.message}; step=${input.expectedCount}; expected_count=${input.expectedCount}; detected_count=${String(evaluation.attachmentCount ?? 0)}; expected_files=${input.expectedFileNames.join("|")}; detected_files=${evaluation.attachmentNames?.join("|") ?? ""}; page_url=${evaluation.pageUrl ?? "unknown"}; composer_candidates=${String(evaluation.composerCandidateCount ?? 0)}; conversation_turns_in_scope=${String(evaluation.conversationTurnCountInScope ?? 0)}; pending=${String(evaluation.pendingAttachmentCount ?? 0)}; send_ready=${String(evaluation.sendReady ?? false)}`,
  );
};

const buildAttachmentTimeoutError = (input: {
  evaluation: WebChatEvaluation | null;
  expectedCount: number;
  expectedFileNames: readonly string[];
}): Error => new Error(
  `GPT_ATTACHMENT_COUNT_MISMATCH; step=${input.expectedCount}; expected_count=${input.expectedCount}; detected_count=${String(input.evaluation?.attachmentCount ?? 0)}; expected_files=${input.expectedFileNames.join("|")}; detected_files=${input.evaluation?.attachmentNames?.join("|") ?? ""}; scope=${input.evaluation?.attachmentScope ?? "none"}; page_url=${input.evaluation?.pageUrl ?? "unknown"}; composer_candidates=${String(input.evaluation?.composerCandidateCount ?? 0)}; conversation_turns_in_scope=${String(input.evaluation?.conversationTurnCountInScope ?? 0)}; pending=${String(input.evaluation?.pendingAttachmentCount ?? 0)}; send_ready=${String(input.evaluation?.sendReady ?? false)}.`,
);

export const waitForExactAttachmentCount = async (
  browser: BrowserController,
  context: AiProviderAdapterContext,
  expectedCount: number,
  expectedFileNames: readonly string[],
  timeoutMs: number,
  options: ExactAttachmentStateOptions = {},
): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + Math.min(timeoutMs, MAX_ATTACHMENT_COUNT_WAIT_MS);
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    const evaluation = await readExactAttachmentState(
      browser,
      context,
      expectedCount,
      expectedFileNames,
      options,
    );
    lastEvaluation = evaluation;
    if (evaluation.status === "success") return evaluation;
    throwIfBlockingDialog(evaluation, expectedCount);
    throwIfTerminalAttachmentEvaluation({ evaluation, expectedCount, expectedFileNames });
    await browser.wait(250);
  }
  throwIfBlockingDialog(lastEvaluation, expectedCount);
  throw buildAttachmentTimeoutError({
    evaluation: lastEvaluation,
    expectedCount,
    expectedFileNames,
  });
};
