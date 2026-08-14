import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import type { WebChatEvaluation } from "./web-chat-evaluation-contract.js";
import {
  pasteTextAndSubmitInChrome,
  pasteTextReplacingInChrome,
} from "./web-chat-clipboard.js";
import {
  verifyPromptPasted,
  verifyPromptSubmitted,
} from "./web-chat-submit-page-actions.js";
import {
  clickChatGptSendButton,
  focusComposer,
  waitForExactAttachmentCount,
  waitForComposerFocused,
} from "./web-chat-page-actions.js";
import { clearComposer } from "./web-chat-upload-page-actions.js";
import {
  acknowledgeChatGptRateLimitDialogIfVisible,
} from "./web-chat-rate-limit-dialog.js";
import { dismissChatGptSearchDialogIfVisible } from "./web-chat-search-dialog-hygiene.js";
import { emitSubmitStage } from "./web-chat-submit-stage-log.js";
import {
  finalizeObservedWebChatSubmission,
  observeSubmittedWebChatTurn,
} from "./web-chat-submission-checkpoint.js";
import { waitForSubmittedUserMessageAttachments } from "./web-chat-submit-attachment-verification.js";

const MAX_SUBMIT_BUTTON_WAIT_MS = 45_000;
const PROMPT_PASTE_VERIFY_TIMEOUT_MS = 20_000;
const GEMINI_PROMPT_PASTE_VERIFY_TIMEOUT_MS = 5_000;
const GEMINI_PROMPT_PASTE_RETRY_LIMIT = 3;
const PROMPT_SUBMISSION_VERIFY_PREFIX_CHARS = 80;
const SUBMITTED_ATTACHMENT_VERIFY_TIMEOUT_MS = 12_000;
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
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  expectedPrefix: string;
  expectedSuffix: string;
  previousUserMessageCount: number;
  wasPromptVerifiedBeforeSubmit: boolean;
  timeoutMs: number;
}): Promise<boolean> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, MAX_SUBMIT_BUTTON_WAIT_MS);
  let lastMessage = "provider submit result was not checked";
  while (Date.now() < deadline) {
    await acknowledgeChatGptSubmitRateLimitIfVisible(input);
    const submitted = await withWebChatStep("verify_prompt_submitted_after_click", () =>
      verifyPromptSubmitted(input.browser, input.context, {
        expectedPrefix: input.expectedPrefix,
        expectedSuffix: input.expectedSuffix,
        previousUserMessageCount: input.previousUserMessageCount,
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
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  step: "click_send_after_prompt_paste";
  timeoutMs: number;
}): Promise<void> => {
  const deadline = Date.now() + Math.min(input.timeoutMs, MAX_SUBMIT_BUTTON_WAIT_MS);
  let lastMessage = "provider send button was not checked";
  while (Date.now() < deadline) {
    await acknowledgeChatGptSubmitRateLimitIfVisible(input);
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
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  initialConversationUrl?: string;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
};
type RateLimitSubmitGuardInput = {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
};
const acknowledgeChatGptSubmitRateLimitIfVisible = async (input: RateLimitSubmitGuardInput): Promise<void> => {
  if (input.request.providerKind !== "gpt-web-chat") return;
  const ackStatus = await acknowledgeChatGptRateLimitDialogIfVisible({
    browser: input.browser,
    context: input.context,
  });
  if (!ackStatus) return;
  emitSubmitStage(
    input,
    "rate_limit_acknowledgement",
    ackStatus === "rate_limit_ack_clicked_in_place" ? "success" : "fallback",
    null,
    {
    ackStatus,
    },
  );
};

type PreparedPromptComposer = {
  expectedLength: number;
  expectedPrefix: string;
  expectedSuffix: string;
  expectedAttachmentCount: number;
  expectedAttachmentKind: "image" | "file";
  wasPromptVerifiedBeforeSubmit: true;
};
const requestHasUploadableInputRefs = (request: AiFeedInput): boolean =>
  request.inputRefs.some((ref) => Boolean(ref.filePath));

const focusComposerBeforePrompt = async (input: SubmitPromptViaClipboardInput): Promise<void> => {
  if (input.request.providerForkRef) {
    const focused = await withWebChatStep("focus_fresh_fork_composer_before_prompt_paste", () =>
      focusComposer(input.browser, input.context));
    if (focused.status !== "success") {
      throw new Error(`${focused.status}: ${focused.message}`);
    }
    await withWebChatStep("verify_fresh_fork_composer_focus_before_prompt_paste", () =>
      waitForComposerFocused(input.browser, input.context, 5_000));
    return;
  }
  await acknowledgeChatGptSubmitRateLimitIfVisible(input);
  await dismissChatGptSearchDialogIfVisible(input.browser, input.context);
  await input.browser.wait(200);
  await acknowledgeChatGptSubmitRateLimitIfVisible(input);
  const focused = await withWebChatStep("focus_composer_before_prompt_paste", () =>
    focusComposer(input.browser, input.context));
  if (focused.status !== "success") {
    throw new Error(`${focused.status}: ${focused.message}`);
  }
  await withWebChatStep("verify_composer_focus_before_prompt_paste", () =>
    waitForComposerFocused(input.browser, input.context, 5_000));
};

const waitForPromptReady = async (input: {
  browser: BrowserTargetSession;
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
    await acknowledgeChatGptSubmitRateLimitIfVisible(input);
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
): Promise<WebChatEvaluation> => {
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
          pasteTextReplacingInChrome(input.browser, input.request.textPrompt, input.context.abortSignal));
      } else {
        await withWebChatStep("paste_prompt_text", () =>
          pasteTextAndSubmitInChrome(input.browser, input.request.textPrompt, input.context.abortSignal));
      }
      const promptReady = await waitForPromptReady({
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
      return promptReady;
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

const promptAttachmentExpectation = (
  request: AiFeedInput,
): Pick<PreparedPromptComposer, "expectedAttachmentCount" | "expectedAttachmentKind"> => {
  const refs = request.inputRefs.filter((ref) => Boolean(ref.filePath));
  return {
    expectedAttachmentCount: refs.length,
    expectedAttachmentKind: refs.every((ref) => ref.mimeType?.startsWith("image/") === true)
      ? "image" : "file",
  };
};

const verifyAttachmentsBeforeSubmit = async (
  input: SubmitPromptViaClipboardInput,
  expectedAttachmentCount: number,
): Promise<void> => {
  if (expectedAttachmentCount <= 0) return;
  if (input.attachmentUploadProof.status !== "attachments_stable") {
    throw new Error(`review_required: attachment proof is not stable before prompt submission; status=${input.attachmentUploadProof.status}`);
  }
  const expectedFileNames = [...input.attachmentUploadProof.files]
    .sort((left, right) => left.order - right.order)
    .map((file) => file.displayFileName);
  if (expectedFileNames.length !== expectedAttachmentCount) {
    throw new Error(`review_required: attachment proof count does not match request before prompt submission; request=${expectedAttachmentCount}; proof=${expectedFileNames.length}`);
  }
  const startedAtMs = Date.now();
  emitSubmitStage(input, "verify_attachments_before_submit", "start", null, {
    expectedAttachmentCount,
  });
  await withWebChatStep("verify_attachments_before_submit", () =>
    waitForExactAttachmentCount(
      input.browser, input.context, expectedAttachmentCount, expectedFileNames, 10_000,
    ));
  emitSubmitStage(input, "verify_attachments_before_submit", "success", startedAtMs, {
    expectedAttachmentCount,
  });
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
  const { expectedAttachmentCount, expectedAttachmentKind } =
    promptAttachmentExpectation(input.request);
  await focusComposerBeforePrompt(input);
  await pastePromptIntoComposer({
    ...input,
    expectedLength,
    expectedPrefix,
    expectedSuffix,
  });
  await verifyAttachmentsBeforeSubmit(input, expectedAttachmentCount);
  if (expectedAttachmentCount > 0) {
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
  }
  emitSubmitStage(input, "prompt_prepare", "success", prepareStartedAtMs, {
    expectedChars: expectedLength,
    expectedAttachmentCount,
    expectedAttachmentKind,
    wasPromptVerifiedBeforeSubmit: true,
  });
  return {
    expectedLength,
    expectedPrefix,
    expectedSuffix,
    expectedAttachmentCount,
    expectedAttachmentKind,
    wasPromptVerifiedBeforeSubmit: true,
  };
};

const submitPromptFromComposer = async (input: SubmitPromptViaClipboardInput & {
  preparedPrompt: PreparedPromptComposer;
}): Promise<WebChatSubmissionProof | null> => {
  const submitStartedAtMs = Date.now();
  emitSubmitStage(input, "prompt_submit", "start", null,
    { expectedAttachmentCount: input.preparedPrompt.expectedAttachmentCount });
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
    expectedSuffix: input.preparedPrompt.expectedSuffix,
    previousUserMessageCount: input.previousUserMessageCount,
    wasPromptVerifiedBeforeSubmit: input.preparedPrompt.wasPromptVerifiedBeforeSubmit,
    timeoutMs: input.request.timeoutMs,
  });
  if (submittedAfterClick) {
    const submission = await observeSubmittedWebChatTurn({
      browser: input.browser,
      context: input.context,
      request: input.request,
      previousAssistantCount: input.previousAssistantCount,
      previousUserMessageCount: input.previousUserMessageCount,
      ...(input.initialConversationUrl ? { initialConversationUrl: input.initialConversationUrl } : {}),
      uploadedFiles: input.uploadedFiles,
      attachmentUploadProof: input.attachmentUploadProof,
    });
    await waitForSubmittedUserMessageAttachments({
      browser: input.browser,
      context: input.context,
      request: input.request,
      expectedCount: input.preparedPrompt.expectedAttachmentCount,
      expectedKind: input.preparedPrompt.expectedAttachmentKind,
      expectedFileNames: input.attachmentUploadProof.files
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((file) => file.displayFileName),
      turnMarker:
        input.context.webChatExecution?.turnMarker
        ?? input.preparedPrompt.expectedSuffix.match(
          /GRASSEYE_TURN_[A-Za-z0-9_-]+/u,
        )?.[0]
        ?? "",
      timeoutMs: SUBMITTED_ATTACHMENT_VERIFY_TIMEOUT_MS,
      acknowledgeRateLimit: () => acknowledgeChatGptSubmitRateLimitIfVisible(input),
    });
    await finalizeObservedWebChatSubmission({
      browser: input.browser,
      context: input.context,
      request: input.request,
      previousAssistantCount: input.previousAssistantCount,
      previousUserMessageCount: input.previousUserMessageCount,
      uploadedFiles: input.uploadedFiles,
      attachmentUploadProof: input.attachmentUploadProof,
    }, submission);
    if (!input.context.webChatExecution) {
      emitSubmitStage(input, "prompt_submit", "success", submitStartedAtMs, {
        method: "provider_dom_send_button",
      });
    }
    return submission;
  }
  emitSubmitStage(input, "prompt_submit", "failed", submitStartedAtMs, {
    reason: "not_submitted",
  });
  throw new Error("GPT_PROMPT_MISMATCH; review_required: provider prompt was not submitted after return and send click.");
};

export const submitPromptViaClipboard = async (
  input: SubmitPromptViaClipboardInput,
): Promise<WebChatSubmissionProof | null> => {
  try {
    const preparedPrompt = await preparePromptComposer(input);
    return await submitPromptFromComposer({
      ...input,
      preparedPrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/GPT_ATTACHMENT_(?:COUNT|FILENAME|HASH)_MISMATCH/u.test(message)) {
      throw error;
    }
    if (message.includes("GPT_PROMPT_MISMATCH")) {
      throw error;
    }
    throw new Error(`GPT_PROMPT_MISMATCH; ${message}`);
  }
};
