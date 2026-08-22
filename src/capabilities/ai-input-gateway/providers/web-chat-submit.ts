import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { pasteTextAndSubmitInChrome } from "./web-chat-clipboard.js";
import { focusComposer, clickChatGptSendButton } from "./web-chat-page-actions.js";
import { dismissChatGptSearchDialogIfVisible } from "./web-chat-search-dialog-hygiene.js";
import { verifyPromptPasted, verifyPromptSubmitted } from "./web-chat-submit-page-actions.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";
import { recordWebChatPageAction } from "./web-chat-page-action-contract.js";

type SubmitPromptViaClipboardInput = Readonly<{
  browser: BrowserTargetLease;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  initialConversationUrl?: string;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
}>;

const normalized = (value: string): string => value.replace(/\s+/gu, " ").trim();

type PromptIdentity = Readonly<{ text: string; prefix: string; suffix: string }>;

const writePromptAndProve = async (
  input: SubmitPromptViaClipboardInput,
  prompt: PromptIdentity,
): Promise<void> => {
  const focused = await focusComposer(input.browser, input.context);
  if (focused.status !== "success") throw new Error(focused.message);
  const startedAt = new Date().toISOString();
  await pasteTextAndSubmitInChrome(input.browser, prompt.text, input.context.abortSignal);
  const pasted = await verifyPromptPasted(input.browser, input.context, {
    expectedLength: prompt.text.length,
    expectedPrefix: prompt.prefix,
    expectedSuffix: prompt.suffix,
  });
  if (pasted.status !== "success") throw new Error(pasted.message);
  await recordWebChatPageAction({
    browser: input.browser, context: input.context, actionId: "write_exact_prompt", startedAt,
    beforeUrl: focused.pageUrl ?? null, afterUrl: pasted.pageUrl ?? null,
    result: "committed", candidateCount: 1,
    semantics: ["exact normalized length", "prefix and suffix present", "one enabled send control"],
  });
};

const persistSubmission = async (input: SubmitPromptViaClipboardInput, submission: WebChatSubmissionProof): Promise<void> => {
  const execution = input.context.webChatExecution;
  if (!execution) return;
  await execution.onSubmissionObserved({
    submission,
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
  });
  await execution.onSubmitted({
    submission,
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
  });
};

const waitForSubmittedTurn = async (
  input: SubmitPromptViaClipboardInput,
  prompt: PromptIdentity,
  click: Awaited<ReturnType<typeof clickChatGptSendButton>>,
): Promise<WebChatSubmissionProof> => {
  const deadline = Date.now() + Math.min(input.request.timeoutMs, 45_000);
  while (Date.now() < deadline) {
    const submitted = await verifyPromptSubmitted(input.browser, input.context, {
      expectedLength: prompt.text.length, expectedPrefix: prompt.prefix, expectedSuffix: prompt.suffix,
      previousUserMessageCount: input.previousUserMessageCount, wasPromptVerifiedBeforeSubmit: true,
    });
    if (submitted.status === "review_required" || submitted.status === "failed") throw new Error(submitted.message);
    if (submitted.status !== "success") {
      await input.browser.wait({ durationMs: 250 });
      continue;
    }
    const proof = await captureWebChatSubmissionProof({
      browser: input.browser, context: input.context, request: input.request,
      previousAssistantCount: input.previousAssistantCount,
      previousUserMessageCount: input.previousUserMessageCount,
      ...(input.initialConversationUrl ? { initialConversationUrl: input.initialConversationUrl } : {}),
      requireCanonical: true,
    });
    await persistSubmission(input, proof);
    await recordWebChatPageAction({
      browser: input.browser, context: input.context, actionId: "submit_exact_turn",
      startedAt: click.actionStartedAt ?? new Date().toISOString(),
      beforeUrl: click.beforeUrl ?? null, afterUrl: submitted.pageUrl ?? proof.canonicalConversationUrl,
      result: "committed", candidateCount: 1,
      semantics: [proof.userTurnId, "exact prompt materialized", "composer cleared", "submission durable"],
      allowDocumentChange: true,
    });
    return proof;
  }
  throw new Error("review_required: provider prompt did not reach the exact submitted-turn boundary");
};

export const submitPromptViaClipboard = async (
  input: SubmitPromptViaClipboardInput,
): Promise<WebChatSubmissionProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("GPT_PROMPT_MISMATCH; review_required: NOT_PRODUCTION_VERIFIED: Gemini submit DOM is not observed");
  }
  if (input.request.inputRefs.some((ref) => Boolean(ref.filePath))) {
    throw new Error("GPT_PROMPT_MISMATCH; review_required: submitted ChatGPT attachment binding is not production verified");
  }
  const text = normalized(input.request.textPrompt);
  const prompt = { text, prefix: text.slice(0, 80), suffix: text.slice(-80) };
  try {
    await dismissChatGptSearchDialogIfVisible(input.browser, input.context);
    await writePromptAndProve(input, prompt);
    const clicked = await clickChatGptSendButton(input.browser, input.context);
    if (clicked.status !== "success") throw new Error(clicked.message);
    return await waitForSubmittedTurn(input, prompt, clicked);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GPT_PROMPT_MISMATCH; ${message}`);
  }
};
