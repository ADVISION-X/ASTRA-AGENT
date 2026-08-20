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
import { verifyPromptPasted, verifyPromptSubmitted } from "./web-chat-submit-page-actions.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";

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

export const submitPromptViaClipboard = async (
  input: SubmitPromptViaClipboardInput,
): Promise<WebChatSubmissionProof | null> => {
  if (input.request.providerKind !== "gpt-web-chat") {
    throw new Error("GPT_PROMPT_MISMATCH; review_required: NOT_PRODUCTION_VERIFIED: Gemini submit DOM is not observed");
  }
  if (input.request.inputRefs.some((ref) => Boolean(ref.filePath))) {
    throw new Error("GPT_PROMPT_MISMATCH; review_required: submitted ChatGPT attachment binding is not production verified");
  }
  const prompt = normalized(input.request.textPrompt);
  const expectedPrefix = prompt.slice(0, 80);
  const expectedSuffix = prompt.slice(-80);
  try {
    const focused = await focusComposer(input.browser, input.context);
    if (focused.status !== "success") throw new Error(focused.message);
    await pasteTextAndSubmitInChrome(input.browser, prompt, input.context.abortSignal);
    const pasted = await verifyPromptPasted(input.browser, input.context, {
      expectedLength: prompt.length,
      expectedPrefix,
      expectedSuffix,
    });
    if (pasted.status !== "success") throw new Error(pasted.message);
    const clicked = await clickChatGptSendButton(input.browser, input.context);
    if (clicked.status !== "success") throw new Error(clicked.message);
    const deadline = Date.now() + Math.min(input.request.timeoutMs, 45_000);
    while (Date.now() < deadline) {
      const submitted = await verifyPromptSubmitted(input.browser, input.context, {
        expectedLength: prompt.length,
        expectedPrefix,
        expectedSuffix,
        previousUserMessageCount: input.previousUserMessageCount,
        wasPromptVerifiedBeforeSubmit: true,
      });
      if (submitted.status === "success") {
        const proof = await captureWebChatSubmissionProof({
          browser: input.browser,
          context: input.context,
          request: input.request,
          previousAssistantCount: input.previousAssistantCount,
          previousUserMessageCount: input.previousUserMessageCount,
          ...(input.initialConversationUrl ? { initialConversationUrl: input.initialConversationUrl } : {}),
          requireCanonical: true,
        });
        await persistSubmission(input, proof);
        return proof;
      }
      if (submitted.status === "review_required" || submitted.status === "failed") throw new Error(submitted.message);
      await input.browser.wait({ durationMs: 250 });
    }
    throw new Error("review_required: provider prompt did not reach the exact submitted-turn boundary");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GPT_PROMPT_MISMATCH; ${message}`);
  }
};
