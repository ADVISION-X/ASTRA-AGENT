import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderAdapterContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation.js";
import {
  pasteTextAndSubmitInChrome,
  pasteTextReplacingInChrome,
  pressReturnInChrome,
} from "./web-chat-clipboard.js";
import {
  verifyLastUserMessageAttachments,
  verifyPromptPasted,
  verifyPromptSubmitted,
} from "./web-chat-submit-page-actions.js";
import {
  clickChatGptSendButton,
  focusComposer,
  waitForAttachmentCountAtLeast,
  waitForComposerFocused,
} from "./web-chat-page-actions.js";
import { clearComposer } from "./web-chat-upload-page-actions.js";
import { acknowledgePick3RateLimitDialogIfVisible, isChatGptRateLimitDialogVisible, reservePick3RateLimitAttempt } from "./web-chat-pick3-recovery-log.js";

const MAX_SUBMIT_BUTTON_WAIT_MS = 45_000;
const PROMPT_PASTE_VERIFY_TIMEOUT_MS = 20_000;
const GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS = 5_000;
const GEMINI_PROMPT_PASTE_RETRY_LIMIT = 3;
const PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS = 80;
const SUBMITTED_ATTACHMENT_VERIFY_TIMEOUT_MS = 12_000;

const terminalStageLog = (line: string): void => {
  process.stdout.write(`[GRASSEYE][AI-GATEWAY][WEB-CHAT] ${line}\n`);
};

const formatStageRefs = (refs: Record<string, string | number | boolean | null | undefined>): string =>
  Object.entries(refs)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");

const emitSubmitStage = (
  input: SubmitPromptViaClipboardInput,
  stage: string,
  status: "start" | "success" | "fallback" | "failed",
  startedAtMs: number | null,
  refs: Record<string, string | number | boolean | null | undefined> = {},
): void => {
  terminalStageLog(formatStageRefs({
    stage,
    status,
    providerKind: input.request.providerKind,
    promptPackageId: input.request.promptPackageId,
    promptContractId: input.request.promptContractId,
    elapsedMs: startedAtMs === null ? undefined : Date.now() - startedAtMs,
    ...refs,
  }));
};

const normalizePromptForSubmission = (promptText: string): string =>
  promptText.replace(/\s+/gu, " ").trim();

const buildPromptSubmissionExpectedPrefix = (normalizedPrompt: string): string =>
  normalizedPrompt.slice(0, PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS);

const buildPromptSubmissionExpectedSuffix = (normalizedPrompt: string): string =>
  normalizedPrompt.slice(-PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS);

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
  request: AiFeedInput;
  expectedPrefix: string;
  previousAssistantCount: number;
  wasPromptVerifiedBeforeSubmit: boolean;
  timeoutMs: number;
}): Promise<boolean> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, MAX_SUBMIT_BUTTON_WAIT_MS);
  let lastMessage = "provider submit result was not checked";
  while (Date.now() < deadline) {
    await acknowledgePick3SubmitRateLimitIfVisible(input);
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

const waitForSendButtonClick = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  step: "click_send_after_prompt_paste";
  timeoutMs: number;
}): Promise<void> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, MAX_SUBMIT_BUTTON_WAIT_MS);
  let lastMessage = "provider send button was not checked";
  while (Date.now() < deadline) {
    await acknowledgePick3SubmitRateLimitIfVisible(input);
    const clicked = await withWebChatStep(input.step, () =>
      clickChatGptSendButton(input.browser, input.context));
    lastMessage = `${clicked.status}: ${clicked.message}`;
    if (clicked.status === "success") return;
    if (clicked.status === "review_required" || clicked.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(750);
  }
  throw new Error(`review_required: provider send button did not become ready after verified paste; last=${lastMessage}`);
};

type SubmitPromptViaClipboardInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  previousAssistantCount: number;
};

type Pick3RateLimitSubmitGuardInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
};

const isPick3GptSubmitRequest = (request: AiFeedInput): boolean =>
  request.providerKind === "gpt-web-chat" && request.promptContractId.startsWith("pick3-is-blind-eval");

// The only action on a visible rate-limit dialog is clicking acknowledgement, repeated
// indefinitely until it is gone — no attempt cap, no escalation, no reopen, no resend.
const acknowledgePick3SubmitRateLimitIfVisible = async (input: Pick3RateLimitSubmitGuardInput): Promise<void> => {
  if (!isPick3GptSubmitRequest(input.request)) return;
  if (!await isChatGptRateLimitDialogVisible(input)) return;
  const rateLimitAttempt = reservePick3RateLimitAttempt(input.request);
  await acknowledgePick3RateLimitDialogIfVisible({
    browser: input.browser,
    request: input.request,
    context: input.context,
    attemptIndex: rateLimitAttempt,
  });
};

type PreparedPromptComposer = {
  expectedLength: number;
  expectedPrefix: string;
  expectedSuffix: string;
  expectedAttachmentCount: number;
  wasPromptVerifiedBeforeSubmit: true;
};

const requestHasUploadableInputRefs = (request: AiFeedInput): boolean =>
  request.inputRefs.some((ref) => Boolean(ref.filePath));

const dismissFloatingMenus = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  await input.browser.evaluateActiveTab<void>({
    description: "dismiss any open context menus or dialogs before composer focus",
    script: `
const floating = Array.from(document.querySelectorAll('[role="menu"], [role="listbox"], [role="dialog"], [data-radix-popper-content-wrapper]'))
  .filter((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
if (floating.length > 0) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
  document.activeElement instanceof HTMLElement && document.activeElement.blur();
}
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
};

const focusComposerBeforePrompt = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  await dismissFloatingMenus(input);
  await input.browser.wait(200);
  const focused = await withWebChatStep("focus_composer_before_prompt_paste", () =>
    focusComposer(input.browser, input.context));
  if (focused.status !== "success") {
    throw new Error(`${focused.status}: ${focused.message}`);
  }
  await withWebChatStep("verify_composer_focus_before_prompt_paste", () =>
    waitForComposerFocused(input.browser, input.context, 5_000));
};

const waitForPromptReady = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  expectedLength: number;
  expectedPrefix: string;
  expectedSuffix: string;
  timeoutMs: number;
  step: string;
}): Promise<WebChatEvaluation> => {
  const deadline = Date.now() + input.timeoutMs;
  let lastMessage = "provider prompt readiness was not checked";
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    await acknowledgePick3SubmitRateLimitIfVisible(input);
    const evaluation = await withWebChatStep(input.step, () =>
      verifyPromptPasted(input.browser, input.context, {
        expectedLength: input.expectedLength,
        expectedPrefix: input.expectedPrefix,
        expectedSuffix: input.expectedSuffix,
      }));
    lastEvaluation = evaluation;
    lastMessage = `${evaluation.status}: ${evaluation.message}`;
    if (evaluation.status === "success") return evaluation;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(250);
  }
  throw new Error(
    `review_required: ${input.step}; last=${lastMessage}; composerChars=${String(lastEvaluation?.composerText?.trim().length ?? 0)}; expectedChars=${String(input.expectedLength)}; prefixVisible=${String(lastEvaluation?.promptPrefixVisible ?? false)}; suffixVisible=${String(lastEvaluation?.promptSuffixVisible ?? false)}; pastedCard=${String(lastEvaluation?.hasPastedTextCard ?? false)}; sendReady=${String(lastEvaluation?.sendReady ?? false)}`,
  );
};

const waitForSubmittedUserMessageAttachments = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  expectedCount: number;
  timeoutMs: number;
}): Promise<void> => {
  if (input.expectedCount <= 0) return;
  const deadline = Date.now() + input.timeoutMs;
  let lastMessage = "provider submitted attachment binding was not checked";
  let lastEvaluation: WebChatEvaluation | null = null;
  while (Date.now() < deadline) {
    await acknowledgePick3SubmitRateLimitIfVisible(input);
    const evaluation = await withWebChatStep("verify_last_user_message_bound_attachments", () =>
      verifyLastUserMessageAttachments(input.browser, input.context, input.expectedCount));
    lastEvaluation = evaluation;
    lastMessage = `${evaluation.status}: ${evaluation.message}`;
    if (evaluation.status === "success") return;
    if (evaluation.status === "review_required" || evaluation.status === "failed") {
      throw new Error(lastMessage);
    }
    await input.browser.wait(500);
  }
  throw new Error(
    `review_required: provider_missing_bound_image; expected=${input.expectedCount}; detected=${String(lastEvaluation?.boundAttachmentCount ?? 0)}; last=${lastMessage}`,
  );
};

const clearComposerBeforePromptPaste = async (
  input: SubmitPromptViaClipboardInput,
): Promise<void> => {
  if (requestHasUploadableInputRefs(input.request)) {
    return;
  }
  const cleared = await withWebChatStep("clear_composer_before_prompt_paste", () =>
    clearComposer(input.browser, input.context));
  if (cleared.status !== "success") {
    throw new Error(`${cleared.status}: ${cleared.message}`);
  }
  await input.browser.wait(250);
};

const pastePromptIntoComposer = async (
  input: SubmitPromptViaClipboardInput & {
    expectedLength: number;
    expectedPrefix: string;
    expectedSuffix: string;
  },
): Promise<void> => {
  await clearComposerBeforePromptPaste(input);
  const pasteStage = input.request.providerKind === "gemini-web-chat"
    ? "gemini_clipboard_prompt_paste"
    : "clipboard_prompt_paste";
  const pasteVerifyTimeoutMs = input.request.providerKind === "gemini-web-chat"
    ? GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS
    : PROMPT_PASTE_VERIFY_TIMEOUT_MS;
  const pasteVerifyStep = input.request.providerKind === "gemini-web-chat"
    ? "verify_gemini_prompt_pasted_before_submit"
    : "verify_prompt_pasted_before_submit";
  const pasteStartedAtMs = Date.now();
  const pasteRetryLimit = input.request.providerKind === "gemini-web-chat"
    ? GEMINI_PROMPT_PASTE_RETRY_LIMIT
    : 1;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= pasteRetryLimit; attempt += 1) {
    const attemptStartedAtMs = Date.now();
    emitSubmitStage(input, pasteStage, "start", null, {
      attempt,
      expectedChars: input.expectedLength,
      timeoutMs: pasteVerifyTimeoutMs,
    });
    try {
      if (attempt > 1 || input.request.providerKind === "gemini-web-chat") {
        await focusComposerBeforePrompt(input);
        await withWebChatStep("paste_prompt_text_replace", () =>
          pasteTextReplacingInChrome(input.request.textPrompt, input.context.abortSignal));
      } else {
        await withWebChatStep("paste_prompt_text", () =>
          pasteTextAndSubmitInChrome(input.request.textPrompt, input.context.abortSignal));
      }
      await waitForPromptReady({
        browser: input.browser,
        context: input.context,
        request: input.request,
        expectedLength: input.expectedLength,
        expectedPrefix: input.expectedPrefix,
        expectedSuffix: input.expectedSuffix,
        timeoutMs: pasteVerifyTimeoutMs,
        step: pasteVerifyStep,
      });
      emitSubmitStage(input, pasteStage, "success", pasteStartedAtMs, {
        attempt,
        attemptElapsedMs: Date.now() - attemptStartedAtMs,
        expectedChars: input.expectedLength,
      });
      return;
    } catch (error) {
      lastError = error;
      emitSubmitStage(input, pasteStage, attempt >= pasteRetryLimit ? "failed" : "fallback", attemptStartedAtMs, {
        attempt,
        reason: error instanceof Error ? error.message : String(error),
      });
      if (attempt < pasteRetryLimit) await input.browser.wait(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "prompt paste failed"));
};

const preparePromptComposer = async (
  input: SubmitPromptViaClipboardInput,
): Promise<PreparedPromptComposer> => {
  const prepareStartedAtMs = Date.now();
  emitSubmitStage(input, "prompt_prepare", "start", null, {
    inputFileCount: input.request.inputRefs.filter((ref) => Boolean(ref.filePath)).length,
  });
  const normalizedPrompt = normalizePromptForSubmission(input.request.textPrompt);
  const expectedLength = normalizedPrompt.length;
  const expectedPrefix = buildPromptSubmissionExpectedPrefix(normalizedPrompt);
  const expectedSuffix = buildPromptSubmissionExpectedSuffix(normalizedPrompt);
  const expectedAttachmentCount = input.request.inputRefs.filter((ref) => Boolean(ref.filePath)).length;
  await focusComposerBeforePrompt(input);
  await pastePromptIntoComposer({
    ...input,
    expectedLength,
    expectedPrefix,
    expectedSuffix,
  });
  if (expectedAttachmentCount > 0) {
    const attachmentStartedAtMs = Date.now();
    emitSubmitStage(input, "verify_attachments_before_submit", "start", null, {
      expectedAttachmentCount,
    });
    await withWebChatStep("verify_attachments_before_submit", () =>
      waitForAttachmentCountAtLeast(input.browser, input.context, expectedAttachmentCount, 10_000));
    emitSubmitStage(input, "verify_attachments_before_submit", "success", attachmentStartedAtMs, {
      expectedAttachmentCount,
    });
  }
  await waitForPromptReady({
    browser: input.browser,
    context: input.context,
    request: input.request,
    expectedLength,
    expectedPrefix,
    expectedSuffix,
    timeoutMs: PROMPT_PASTE_VERIFY_TIMEOUT_MS,
    step: "verify_prompt_ready_before_submit",
  });
  emitSubmitStage(input, "prompt_prepare", "success", prepareStartedAtMs, {
    expectedChars: expectedLength,
    expectedAttachmentCount,
  });
  return {
    expectedLength,
    expectedPrefix,
    expectedSuffix,
    expectedAttachmentCount,
    wasPromptVerifiedBeforeSubmit: true,
  };
};

const submitPromptFromComposer = async (input: SubmitPromptViaClipboardInput & {
  preparedPrompt: PreparedPromptComposer;
}): Promise<void> => {
  const submitStartedAtMs = Date.now();
  emitSubmitStage(input, "prompt_submit", "start", null, {
    expectedAttachmentCount: input.preparedPrompt.expectedAttachmentCount,
  });
  await withWebChatStep("press_return_after_prompt_paste", () =>
    pressReturnInChrome(input.context.abortSignal));
  const submittedAfterReturn = await waitForPromptSubmitted({
    browser: input.browser,
    context: input.context,
    request: input.request,
    expectedPrefix: input.preparedPrompt.expectedPrefix,
    previousAssistantCount: input.previousAssistantCount,
    wasPromptVerifiedBeforeSubmit: input.preparedPrompt.wasPromptVerifiedBeforeSubmit,
    timeoutMs: 8_000,
  });
  if (submittedAfterReturn) {
    await waitForSubmittedUserMessageAttachments({
      browser: input.browser,
      context: input.context,
      request: input.request,
      expectedCount: input.preparedPrompt.expectedAttachmentCount,
      timeoutMs: SUBMITTED_ATTACHMENT_VERIFY_TIMEOUT_MS,
    });
    emitSubmitStage(input, "prompt_submit", "success", submitStartedAtMs, {
      method: "return",
    });
    return;
  }
  await waitForSendButtonClick({
    browser: input.browser,
    context: input.context,
    request: input.request,
    step: "click_send_after_prompt_paste",
    timeoutMs: input.request.timeoutMs,
  });
  const submittedAfterClick = await waitForPromptSubmitted({
    browser: input.browser,
    context: input.context,
    request: input.request,
    expectedPrefix: input.preparedPrompt.expectedPrefix,
    previousAssistantCount: input.previousAssistantCount,
    wasPromptVerifiedBeforeSubmit: input.preparedPrompt.wasPromptVerifiedBeforeSubmit,
    timeoutMs: input.request.timeoutMs,
  });
  if (submittedAfterClick) {
    await waitForSubmittedUserMessageAttachments({
      browser: input.browser,
      context: input.context,
      request: input.request,
      expectedCount: input.preparedPrompt.expectedAttachmentCount,
      timeoutMs: SUBMITTED_ATTACHMENT_VERIFY_TIMEOUT_MS,
    });
    emitSubmitStage(input, "prompt_submit", "success", submitStartedAtMs, {
      method: "send_button",
    });
    return;
  }
  emitSubmitStage(input, "prompt_submit", "failed", submitStartedAtMs, {
    reason: "not_submitted",
  });
  throw new Error("review_required: provider prompt was not submitted after return and send click.");
};

export const submitPromptViaClipboard = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  const preparedPrompt = await preparePromptComposer(input);
  await submitPromptFromComposer({
    ...input,
    preparedPrompt,
  });
};
