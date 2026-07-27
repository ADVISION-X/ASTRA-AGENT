import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  WebChatExecutionContext,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { captureWebChatResponseArtifacts } from "./web-chat-response-artifacts.js";
import { extractWebChatConversation } from "./web-chat-response-capture.js";
import {
  buildWebChatRawResponse,
  cleanupProviderWorkspaceAfterResponse,
  persistWorkspaceAfterResponse,
} from "./web-chat-shared-support.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";
import { renameSubmittedChatGptConversation } from "./web-chat-chat-title.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

const finalizeCompletedChatGptTitle = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  submission: WebChatSubmissionProof;
}): Promise<WebChatSubmissionProof> => {
  const execution = input.context.webChatExecution;
  if (
    !execution ||
    execution.providerKind !== "gpt-web-chat" ||
    (input.submission.systemChatTitle === execution.systemChatTitle &&
      input.submission.chatTitleVerifiedAt)
  ) {
    return input.submission;
  }
  if (!execution.resumeAttachmentUploadProof) {
    throw new Error(
      "review_required: submitted ChatGPT execution is missing its attachment proof before title recovery.",
    );
  }
  const renamed = await renameSubmittedChatGptConversation({
    browser: input.browser,
    context: input.context,
    submission: input.submission,
    timeoutMs: input.request.timeoutMs,
  });
  await execution.onConversationCanonicalized(renamed);
  return renamed;
};

const verifyResumableTurn = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<void> => {
  const execution = input.context.webChatExecution;
  if (!execution?.resumeSubmission) {
    throw new Error(
      "review_required: durable web-chat submission proof is unavailable for resume.",
    );
  }
  const identity = await input.browser.evaluateActiveTab<{
    pageUrl: string;
    markerCount: number;
  }>({
    description:
      "verify exact named web-chat conversation marker before resuming provider polling",
    script: `
const marker = ${JSON.stringify(execution.turnMarker)};
const nodes = Array.from(document.querySelectorAll("[data-message-author-role='user'], user-query, user-query-content, .user-query-container"));
const markerCount = nodes.filter((node) => (node.textContent || "").includes(marker)).length;
return { pageUrl: location.href, markerCount };
`,
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  if (identity.markerCount !== 1) {
    throw new Error(
      `review_required: resumable named web-chat conversation does not contain exactly one expected marker; count=${identity.markerCount}; pageUrl=${identity.pageUrl}`,
    );
  }
};

type ResumeConversationInput = {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
};

type ResumedConversation = Awaited<
  ReturnType<typeof extractWebChatConversation>
>;

const readResumedConversation = async (input: {
  requestInput: ResumeConversationInput;
  execution: WebChatExecutionContext;
  submission: WebChatSubmissionProof;
}): Promise<ResumedConversation> => {
  const checkpointAnswer = input.execution.resumeResponseCheckpoint
    ? await readWebChatResponseCheckpoint(input.execution.resumeResponseCheckpoint!)
    : null;
  const conversation = checkpointAnswer === null
    ? await extractWebChatConversation({
        ...input.requestInput,
        previousAssistantCount: input.submission.previousAssistantCount,
        previousAnswerText: null,
      })
    : {
        answerText: checkpointAnswer,
        extracted: {
          status: "success" as const,
          message: "Recovered from durable web-chat response checkpoint.",
          answerText: checkpointAnswer,
          pageUrl: input.execution.resumeResponseCheckpoint!.pageUrl,
        },
      };
  if (!input.execution.resumeResponseCheckpoint) {
    await input.execution.onResponseCaptured({
      answerText: conversation.answerText,
      pageUrl:
        conversation.extracted.pageUrl
        ?? input.submission.canonicalConversationUrl
        ?? input.submission.transientConversationUrl,
    });
  }
  return conversation;
};

const buildResumedResponse = async (input: {
  requestInput: ResumeConversationInput;
  execution: WebChatExecutionContext;
  submission: WebChatSubmissionProof;
  conversation: ResumedConversation;
}): Promise<AiProviderRawResponse> => {
  const conversationUrl =
    input.submission.canonicalConversationUrl
    ?? input.conversation.extracted.pageUrl
    ?? input.submission.transientConversationUrl;
  const { htmlArtifact, jsonArtifact } = await captureWebChatResponseArtifacts({
    ...input.requestInput,
    answerText: input.conversation.answerText,
    conversationUrl,
  });
  return buildWebChatRawResponse({
    request: input.requestInput.request,
    runtimeName: input.requestInput.runtimeName,
    providerUrl: input.requestInput.providerUrl,
    sourcePageUrlBeforeFeed: null,
    extracted: { ...input.conversation.extracted, pageUrl: conversationUrl },
    answerText:
      htmlArtifact?.htmlDocument
      ?? jsonArtifact?.jsonText
      ?? input.conversation.answerText,
    uploadedFiles: input.execution.resumeUploadedFiles,
    ...(input.execution.resumeAttachmentUploadProof
      ? { attachmentUploadProof: input.execution.resumeAttachmentUploadProof }
      : {}),
    outputRefs: [
      ...(htmlArtifact ? [htmlArtifact.outputRef] : []),
      ...(jsonArtifact ? [jsonArtifact.outputRef] : []),
    ],
    managedParallelExecution: true,
  });
};

export const resumeSubmittedWebChatConversation = async (
  input: ResumeConversationInput,
): Promise<AiProviderRawResponse> => {
  await verifyResumableTurn(input);
  const execution = input.context.webChatExecution!;
  const submission = execution.resumeSubmission!;
  const conversation = await readResumedConversation({
    requestInput: input,
    execution,
    submission,
  });
  const finalizedSubmission = await captureWebChatSubmissionProof({
    ...input,
    previousAssistantCount: submission.previousAssistantCount,
    previousUserMessageCount: submission.previousUserMessageCount,
    requireCanonical: true,
  });
  await execution.onConversationCanonicalized(finalizedSubmission);
  const renamedSubmission = await finalizeCompletedChatGptTitle({
    ...input,
    submission: {
      ...finalizedSubmission,
      submittedAt: submission.submittedAt,
    },
  });
  const response = await buildResumedResponse({
    requestInput: input,
    execution,
    submission: renamedSubmission,
    conversation,
  });
  persistWorkspaceAfterResponse({
    request: input.request,
    context: input.context,
    response,
  });
  await cleanupProviderWorkspaceAfterResponse({
    browser: input.browser,
    request: input.request,
    context: input.context,
    response,
  });
  return response;
};
