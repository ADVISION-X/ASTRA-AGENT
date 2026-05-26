import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  pasteTextAndSubmitInChrome,
  pressReturnInChrome,
} from "./web-chat-clipboard.js";
import {
  verifyPromptPasted,
  verifyPromptSubmitted,
} from "./web-chat-submit-page-actions.js";
import {
  clickChatGptSendButton,
  focusComposer,
  waitForAttachmentCountAtLeast,
  waitForChatGptPastedTextCardReady,
  waitForComposerFocused,
} from "./web-chat-page-actions.js";
import { clearComposer } from "./web-chat-upload-page-actions.js";

const MAX_SUBMIT_BUTTON_WAIT_MS = 45_000;
const MAX_PROMPT_PASTE_ATTEMPTS = 3;
const PROMPT_PASTE_VERIFY_TIMEOUT_MS = 3_000;
const PROMPT_READY_BEFORE_SUBMIT_TIMEOUT_MS = 2_000;
const PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS = 80;

const buildPromptSubmissionExpectedPrefix = (promptText: string): string =>
  promptText.replace(/\s+/gu, " ").trim().slice(0, PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS);

const withWebChatStep = async <T>(
  step: string,
  action: () => Promise<T>,
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw new Error(`${step}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const waitForPromptSubmitted = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  expectedPrefix: string;
  previousAssistantCount: number;
  wasPromptVerifiedBeforeSubmit: boolean;
  timeoutMs: number;
}): Promise<boolean> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, MAX_SUBMIT_BUTTON_WAIT_MS);
  let lastMessage = "provider submit result was not checked";
  while (Date.now() < deadline) {
    const submitted = await withWebChatStep("verify_prompt_submitted_after_click", () =>
      verifyPromptSubmitted(input.browser, input.context, {
        expectedPrefix: input.expectedPrefix,
        previousAssistantCount: input.previousAssistantCount,
        wasPromptVerifiedBeforeSubmit: input.wasPromptVerifiedBeforeSubmit,
      }));
    lastMessage = `${submitted.status}: ${submitted.message}`;
    if (submitted.status === "success") return true;
    if (submitted.status === "review_required" || submitted.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(750);
  }
  return false;
};

type SubmitPromptViaClipboardInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  previousAssistantCount: number;
};

type PreparedPromptComposer = {
  expectedPrefix: string;
  wasPromptVerifiedBeforeSubmit: true;
};

const focusComposerBeforePrompt = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const focused = await withWebChatStep("focus_composer_before_prompt_paste", () =>
    focusComposer(input.browser, input.context));
  if (focused.status !== "success") {
    throw new Error(`${focused.status}: ${focused.message}`);
  }
  await withWebChatStep("verify_composer_focus_before_prompt_paste", () =>
    waitForComposerFocused(input.browser, input.context, 2_000));
};

const waitForPromptReady = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  expectedPrefix: string;
  timeoutMs: number;
  step: string;
}): Promise<void> => {
  const deadline = Date.now() + input.timeoutMs;
  let lastMessage = "provider prompt readiness was not checked";
  while (Date.now() < deadline) {
    const evaluation = await withWebChatStep(input.step, () =>
      verifyPromptPasted(input.browser, input.context, {
        expectedPrefix: input.expectedPrefix,
      }));
    lastMessage = `${evaluation.status}: ${evaluation.message}`;
    if (evaluation.status === "success") return;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(250);
  }
  throw new Error(`review_required: ${input.step}; last=${lastMessage}`);
};

const preparePromptComposer = async (
  input: SubmitPromptViaClipboardInput,
): Promise<PreparedPromptComposer> => {
  const expectedPrefix = buildPromptSubmissionExpectedPrefix(input.request.textPrompt);
  const expectedAttachmentCount = input.request.inputRefs.filter((ref) => Boolean(ref.filePath)).length;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PROMPT_PASTE_ATTEMPTS; attempt += 1) {
    try {
      await focusComposerBeforePrompt(input);
      const cleared = await withWebChatStep("clear_composer_before_prompt_paste", () =>
        clearComposer(input.browser, input.context));
      if (cleared.status !== "success") {
        throw new Error(`${cleared.status}: ${cleared.message}`);
      }
      await input.browser.wait(250);
      await withWebChatStep("paste_prompt_text", () =>
        pasteTextAndSubmitInChrome(input.request.textPrompt, input.context.abortSignal));
      await waitForPromptReady({
        browser: input.browser,
        context: input.context,
        expectedPrefix,
        timeoutMs: PROMPT_PASTE_VERIFY_TIMEOUT_MS,
        step: "verify_prompt_pasted_before_submit",
      });
      if (expectedAttachmentCount > 0) {
        await withWebChatStep("verify_attachments_before_submit", () =>
          waitForAttachmentCountAtLeast(input.browser, input.context, expectedAttachmentCount, 10_000));
      }
      await waitForPromptReady({
        browser: input.browser,
        context: input.context,
        expectedPrefix,
        timeoutMs: PROMPT_READY_BEFORE_SUBMIT_TIMEOUT_MS,
        step: "verify_prompt_ready_before_submit",
      });
      return {
        expectedPrefix,
        wasPromptVerifiedBeforeSubmit: true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === MAX_PROMPT_PASTE_ATTEMPTS) {
        throw new Error(
          `review_required: provider prompt paste verification failed after ${MAX_PROMPT_PASTE_ATTEMPTS} attempts; last=${lastError.message}`,
        );
      }
      await input.browser.wait(500);
    }
  }

  throw lastError ?? new Error("review_required: provider prompt paste verification failed.");
};

const submitPromptFromComposer = async (input: SubmitPromptViaClipboardInput & {
  preparedPrompt: PreparedPromptComposer;
}): Promise<void> => {
  const expectedAttachmentCount = input.request.inputRefs.filter((ref) => Boolean(ref.filePath)).length;
  const pastedTextCard = expectedAttachmentCount === 0
    ? await withWebChatStep("detect_chatgpt_pasted_text_card_before_submit", () =>
      waitForChatGptPastedTextCardReady(input.browser, input.context, 8_000))
    : null;
  await input.browser.wait(2_000);
  await withWebChatStep("press_return_after_prompt_paste", () =>
    pressReturnInChrome(input.context.abortSignal));
  const submittedAfterReturn = await waitForPromptSubmitted({
    browser: input.browser,
    context: input.context,
    expectedPrefix: input.preparedPrompt.expectedPrefix,
    previousAssistantCount: input.previousAssistantCount,
    wasPromptVerifiedBeforeSubmit: input.preparedPrompt.wasPromptVerifiedBeforeSubmit,
    timeoutMs: pastedTextCard ? 8_000 : input.request.timeoutMs,
  });
  if (submittedAfterReturn) return;
  if (pastedTextCard) {
    const clicked = await withWebChatStep("click_send_for_chatgpt_pasted_text_card", () =>
      clickChatGptSendButton(input.browser, input.context));
    if (clicked.status !== "success") {
      throw new Error(`${clicked.status}: ${clicked.message}`);
    }
    const submittedAfterClick = await waitForPromptSubmitted({
      browser: input.browser,
      context: input.context,
      expectedPrefix: input.preparedPrompt.expectedPrefix,
      previousAssistantCount: input.previousAssistantCount,
      wasPromptVerifiedBeforeSubmit: input.preparedPrompt.wasPromptVerifiedBeforeSubmit,
      timeoutMs: input.request.timeoutMs,
    });
    if (submittedAfterClick) return;
  }
  throw new Error("review_required: provider prompt was not submitted after pasted text card handling.");
};

export const submitPromptViaClipboard = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const preparedPrompt = await preparePromptComposer(input);
  await submitPromptFromComposer({
    ...input,
    preparedPrompt,
  });
};
