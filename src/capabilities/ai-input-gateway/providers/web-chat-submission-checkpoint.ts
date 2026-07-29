import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { emitSubmitStage } from "./web-chat-submit-stage-log.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";

type SubmissionCheckpointInput = {
  browser: BrowserController;
  context: AiProviderAdapterContext;
  request: AiFeedInput;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
};

const captureProof = (
  input: SubmissionCheckpointInput,
  requireCanonical: boolean,
): Promise<WebChatSubmissionProof> =>
  captureWebChatSubmissionProof({
    browser: input.browser,
    context: input.context,
    request: input.request,
    previousAssistantCount: input.previousAssistantCount,
    previousUserMessageCount: input.previousUserMessageCount,
    requireCanonical,
  });

const persistObservedSubmission = async (
  input: SubmissionCheckpointInput,
  submission: WebChatSubmissionProof,
): Promise<void> => {
  await input.context.webChatExecution!.onSubmissionObserved({
    submission,
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
  });
};

export const observeSubmittedWebChatTurn = async (
  input: SubmissionCheckpointInput,
): Promise<WebChatSubmissionProof | null> => {
  if (!input.context.webChatExecution) return null;
  let submission = await captureProof(input, false);
  await persistObservedSubmission(input, submission);
  if (
    input.request.providerKind === "gpt-web-chat"
    && !submission.canonicalConversationUrl
  ) {
    submission = await captureProof(input, true);
    await persistObservedSubmission(input, submission);
  }
  return submission;
};

export const finalizeObservedWebChatSubmission = async (
  input: SubmissionCheckpointInput,
  submission: WebChatSubmissionProof | null,
): Promise<WebChatSubmissionProof | null> => {
  if (!input.context.webChatExecution || !submission) return submission;
  await input.context.webChatExecution.onSubmitted({
    submission,
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
  });
  emitSubmitStage(input, "prompt_submit", "success", null, {
    method: "exact_turn_marker_and_canonical_conversation",
    executionId: input.context.webChatExecution.executionId,
    userTurnId: submission.userTurnId,
    canonicalConversationUrl:
      submission.canonicalConversationUrl ?? "pending",
  });
  return submission;
};
