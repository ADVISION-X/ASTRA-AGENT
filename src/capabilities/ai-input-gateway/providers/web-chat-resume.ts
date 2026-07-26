import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
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

const verifyResumableTurn = async (input: {
  browser: BrowserController;
  context: AiProviderAdapterContext;
}): Promise<void> => {
  const execution = input.context.webChatExecution;
  if (!execution?.resumeSubmission) {
    throw new Error("review_required: durable web-chat submission proof is unavailable for resume.");
  }
  const identity = await input.browser.evaluateActiveTab<{ pageUrl: string; markerCount: number }>({
    description: "verify exact named web-chat conversation marker before resuming provider polling",
    script: `
const marker = ${JSON.stringify(execution.turnMarker)};
const nodes = Array.from(document.querySelectorAll("[data-message-author-role='user'], user-query, user-query-content, .user-query-container"));
const markerCount = nodes.filter((node) => (node.textContent || "").includes(marker)).length;
return { pageUrl: location.href, markerCount };
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (identity.markerCount !== 1) {
    throw new Error(`review_required: resumable named web-chat conversation does not contain exactly one expected marker; count=${identity.markerCount}; pageUrl=${identity.pageUrl}`);
  }
};

export const resumeSubmittedWebChatConversation = async (input: {
  browser: BrowserController;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<AiProviderRawResponse> => {
  await verifyResumableTurn(input);
  const execution = input.context.webChatExecution!;
  const submission = execution.resumeSubmission!;
  const conversation = await extractWebChatConversation({
    ...input,
    previousAssistantCount: submission.previousAssistantCount,
    previousAnswerText: null,
  });
  const finalizedSubmission = await captureWebChatSubmissionProof({
    ...input,
    previousAssistantCount: submission.previousAssistantCount,
    previousUserMessageCount: submission.previousUserMessageCount,
    requireCanonical: true,
  });
  await execution.onConversationCanonicalized(finalizedSubmission);
  const conversationUrl = finalizedSubmission.canonicalConversationUrl
    ?? conversation.extracted.pageUrl
    ?? submission.canonicalConversationUrl
    ?? submission.transientConversationUrl;
  const { htmlArtifact, jsonArtifact } = await captureWebChatResponseArtifacts({
    ...input,
    answerText: conversation.answerText,
    conversationUrl,
  });
  const response = buildWebChatRawResponse({
    request: input.request,
    runtimeName: input.runtimeName,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: null,
    extracted: { ...conversation.extracted, pageUrl: conversationUrl },
    answerText: htmlArtifact?.htmlDocument ?? jsonArtifact?.jsonText ?? conversation.answerText,
    uploadedFiles: execution.resumeUploadedFiles,
    ...(execution.resumeAttachmentUploadProof
      ? { attachmentUploadProof: execution.resumeAttachmentUploadProof }
      : {}),
    outputRefs: [
      ...(htmlArtifact ? [htmlArtifact.outputRef] : []),
      ...(jsonArtifact ? [jsonArtifact.outputRef] : []),
    ],
    managedParallelExecution: true,
  });
  persistWorkspaceAfterResponse({ request: input.request, context: input.context, response });
  await cleanupProviderWorkspaceAfterResponse({
    browser: input.browser,
    request: input.request,
    context: input.context,
    response,
  });
  return response;
};
