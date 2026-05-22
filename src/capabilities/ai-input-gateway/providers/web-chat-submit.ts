import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { clickDesktopPoint, pasteTextAndSubmitInChrome } from "./web-chat-clipboard.js";
import {
  clickSubmitButton,
  findSubmitButtonPoint,
  verifyPromptSubmitted,
} from "./web-chat-submit-page-actions.js";
import {
  findComposerPoint,
  focusComposer,
  setComposerText,
  verifyComposerText,
} from "./web-chat-page-actions.js";

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

const waitForSubmitButtonPoint = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  timeoutMs: number;
}): Promise<{ x: number; y: number }> => {
  const deadline = Date.now() + input.timeoutMs;
  let lastMessage = "provider submit button was not checked";
  while (Date.now() < deadline) {
    const submitPoint = await withWebChatStep("find_submit_button_point", () =>
      findSubmitButtonPoint(input.browser, input.context));
    lastMessage = `${submitPoint.status}: ${submitPoint.message}`;
    if (submitPoint.status === "success" && typeof submitPoint.x === "number" && typeof submitPoint.y === "number") {
      return { x: submitPoint.x, y: submitPoint.y };
    }
    if (submitPoint.status === "review_required" || submitPoint.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(1_500);
  }
  throw new Error(`review_required: provider submit button did not become enabled; last=${lastMessage}`);
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
  const point = await withWebChatStep("find_composer_point_before_prompt_paste", () =>
    findComposerPoint(input.browser, input.context));
  if (point.status === "success" && typeof point.x === "number" && typeof point.y === "number") {
    const clickPoint = { x: point.x, y: point.y };
    await withWebChatStep("click_composer_before_prompt_paste", () =>
      clickDesktopPoint(clickPoint, input.context.abortSignal));
  }
  await withWebChatStep("paste_prompt_text", () =>
    pasteTextAndSubmitInChrome(input.request.textPrompt, input.context.abortSignal));
  const verified = await withWebChatStep("verify_prompt_text_after_paste", () =>
    verifyComposerText(input.browser, input.context, input.request.textPrompt));
  if (verified.status !== "success") {
    const setResult = await withWebChatStep("set_prompt_text_after_paste_miss", () =>
      setComposerText(input.browser, input.context, input.request.textPrompt));
    if (setResult.status !== "success") {
      throw new Error(`${setResult.status}: ${setResult.message}`);
    }
  }
};

const submitPromptFromComposer = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const submitPoint = await waitForSubmitButtonPoint({
    browser: input.browser,
    context: input.context,
    timeoutMs: input.request.timeoutMs,
  });
  await withWebChatStep("click_submit_button_dom", () =>
    clickSubmitButton(input.browser, input.context));
  await withWebChatStep("click_submit_button_point", () =>
    clickDesktopPoint(submitPoint, input.context.abortSignal));
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
