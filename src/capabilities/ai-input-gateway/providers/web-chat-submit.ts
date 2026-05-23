import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  pasteTextAndSubmitInChrome,
  pressReturnInChrome,
} from "./web-chat-clipboard.js";
import {
  verifyPromptSubmitted,
} from "./web-chat-submit-page-actions.js";
import {
  focusComposer,
  waitForAttachmentCountAtLeast,
  verifyComposerText,
} from "./web-chat-page-actions.js";
import { clearComposer } from "./web-chat-upload-page-actions.js";

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
  promptText: string;
  previousAssistantCount: number;
  timeoutMs: number;
}): Promise<void> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, 30_000);
  let lastMessage = "provider submit result was not checked";
  while (Date.now() < deadline) {
    const submitted = await withWebChatStep("verify_prompt_submitted_after_click", () =>
      verifyPromptSubmitted(input.browser, input.context, input.promptText, input.previousAssistantCount));
    lastMessage = `${submitted.status}: ${submitted.message}`;
    if (submitted.status === "success") return;
    if (submitted.status === "review_required" || submitted.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(750);
  }
  throw new Error(`review_required: provider prompt was not submitted; last=${lastMessage}`);
};

type SubmitPromptViaClipboardInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  sourceUrl: string | null;
  previousAssistantCount: number;
  restoreSourcePage: (browser: BrowserController, sourceUrl: string | null, abortSignal?: AbortSignal) => Promise<boolean | null>;
};

const focusComposerBeforePrompt = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const focused = await withWebChatStep("focus_composer_before_prompt_paste", () =>
    focusComposer(input.browser, input.context));
  if (focused.status !== "success") {
    const restoredSourcePage = await input.restoreSourcePage(input.browser, input.sourceUrl, input.context.abortSignal);
    throw new Error(`${focused.status}: ${focused.message}; restoredSourcePage=${String(restoredSourcePage)}`);
  }
};

const populatePromptComposer = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const cleared = await withWebChatStep("clear_composer_before_prompt_paste", () =>
    clearComposer(input.browser, input.context));
  if (cleared.status !== "success") {
    throw new Error(`${cleared.status}: ${cleared.message}`);
  }
  await input.browser.wait(250);
  await withWebChatStep("paste_prompt_text", () =>
    pasteTextAndSubmitInChrome(input.request.textPrompt, input.context.abortSignal));
  const verified = await withWebChatStep("verify_prompt_text_after_paste", () =>
    verifyComposerText(input.browser, input.context, input.request.textPrompt));
  if (verified.status !== "success") {
    throw new Error(`${verified.status}: ${verified.message}`);
  }
};

const submitPromptFromComposer = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const expectedAttachmentCount = input.request.inputRefs.filter((ref) => Boolean(ref.filePath)).length;
  if (expectedAttachmentCount > 0) {
    await withWebChatStep("verify_attachments_before_submit", () =>
      waitForAttachmentCountAtLeast(input.browser, input.context, expectedAttachmentCount, 10_000));
  }
  await withWebChatStep("press_return_after_prompt_paste", () =>
    pressReturnInChrome(input.context.abortSignal));
  await waitForPromptSubmitted({
    browser: input.browser,
    context: input.context,
    promptText: input.request.textPrompt,
    previousAssistantCount: input.previousAssistantCount,
    timeoutMs: input.request.timeoutMs,
  });
};

export const submitPromptViaClipboard = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  await focusComposerBeforePrompt(input);
  await populatePromptComposer(input);
  await submitPromptFromComposer(input);
};
