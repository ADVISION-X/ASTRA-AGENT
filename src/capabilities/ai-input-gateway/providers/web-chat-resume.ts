import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  WebChatExecutionContext,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { captureWebChatResponseArtifacts } from "./web-chat-response-artifacts.js";
import { captureChatGptGeneratedImage } from "./web-chat-generated-image-capture.js";
import { extractWebChatConversation } from "./web-chat-response-capture.js";
import {
  buildWebChatRawResponse,
  cleanupProviderWorkspaceAfterResponse,
  persistWorkspaceAfterResponse,
} from "./web-chat-shared-support.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";
import { finalizeWebChatSessionAfterResult } from "./web-chat-session-controller.js";

const legacyIdentityProof = (
  execution: WebChatExecutionContext,
): AiProviderRawResponse["modelIdentityProof"] => {
  const proof = execution.providerExecutionProfileProof;
  return proof ? {
    proofStatus: "verified",
    modelFamily: proof.modelFamily,
    modelDisplayName: proof.modelDisplayName,
    modelIdentityStatus: "verified",
    reasoningEffort: proof.legacyReasoningEffort,
    observedAt: proof.observedAt,
    sourceKind: proof.sourceKind,
    evidenceRef: proof.evidenceRef,
    evidenceHash: proof.evidenceHash,
  } : null;
};

const verifyResumableTurn = async (input: {
  browser: BrowserTargetSession;
  context: AiProviderAdapterContext;
}): Promise<void> => {
  const execution = input.context.webChatExecution;
  if (!execution?.resumeSubmission) {
    throw new Error("review_required: durable web-chat submission proof is unavailable for resume.");
  }
  const identity = await input.browser.evaluate<{ pageUrl: string; markerCount: number }>({
    description: "verify exact canonical web-chat marker before resuming provider polling",
    script: `
const marker=${JSON.stringify(execution.turnMarker)};
const normalized=(value)=>String(value||"").replace(/\\s+/gu," ").trim();
const nodes=Array.from(document.querySelectorAll("[data-testid^='conversation-turn-'][data-turn='user']"));
const markerCount=nodes.filter((node)=>normalized(node.textContent).includes(marker)).length;
return {pageUrl:location.href,markerCount};
`,
    ...(input.context.abortSignal ? { abortSignal: input.context.abortSignal } : {}),
  });
  if (identity.markerCount !== 1) {
    throw new Error(
      `review_required: resumable canonical web-chat marker mismatch; count=${identity.markerCount}; pageUrl=${identity.pageUrl}`,
    );
  }
};

type ResumeConversationInput = {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
};

type ResumedConversation = Awaited<ReturnType<typeof extractWebChatConversation>>;

const readResumedConversation = async (input: {
  requestInput: ResumeConversationInput;
  execution: WebChatExecutionContext;
  submission: WebChatSubmissionProof;
}): Promise<ResumedConversation> => {
  const checkpointAnswer = input.execution.resumeResponseCheckpoint
    ? await readWebChatResponseCheckpoint(input.execution.resumeResponseCheckpoint)
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
      pageUrl: conversation.extracted.pageUrl
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
  conversationTitleProof: AiProviderRawResponse["conversationTitleProof"];
}): Promise<AiProviderRawResponse> => {
  const conversationUrl = input.submission.canonicalConversationUrl
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
    answerText: htmlArtifact?.htmlDocument
      ?? jsonArtifact?.jsonText
      ?? input.conversation.answerText,
    modelIdentityProof: legacyIdentityProof(input.execution),
    providerExecutionProfileProof: input.execution.providerExecutionProfileProof,
    conversationTitleProof: input.conversationTitleProof,
    uploadedFiles: input.execution.resumeUploadedFiles,
    ...(input.execution.resumeAttachmentUploadProof
      ? { attachmentUploadProof: input.execution.resumeAttachmentUploadProof } : {}),
    outputRefs: [
      ...(htmlArtifact ? [htmlArtifact.outputRef] : []),
      ...(jsonArtifact ? [jsonArtifact.outputRef] : []),
    ],
    managedParallelExecution: true,
    forkActionProof: input.execution.resumeForkActionProof,
    submissionProof: input.submission,
  });
};

const resumeGeneratedImageConversation = async (
  input: ResumeConversationInput,
  execution: WebChatExecutionContext,
  submission: WebChatSubmissionProof,
): Promise<AiProviderRawResponse> => {
  const generatedImage = await captureChatGptGeneratedImage({
    browser: input.browser,
    request: input.request,
    context: input.context,
  });
  if (!generatedImage) {
    throw new Error("review_required: generated image artifact was not captured during resume");
  }
  const finalizedSubmission = await captureWebChatSubmissionProof({
    ...input,
    previousAssistantCount: submission.previousAssistantCount,
    previousUserMessageCount: submission.previousUserMessageCount,
    ...(execution.resumeForkActionProof?.childConversationUrl
      ? { initialConversationUrl: execution.resumeForkActionProof.childConversationUrl } : {}),
    requireCanonical: true,
  });
  await execution.onConversationCanonicalized(finalizedSubmission);
  await execution.onGeneratedImageCheckpointed({
    outputHash: generatedImage.sha256,
    pageUrl: finalizedSubmission.canonicalConversationUrl
      ?? finalizedSubmission.transientConversationUrl,
  });
  const conversationTitleProof = await finalizeWebChatSessionAfterResult({
    browser: input.browser,
    context: input.context,
    request: input.request,
    submission: finalizedSubmission,
  });
  const conversationUrl = finalizedSubmission.canonicalConversationUrl
    ?? finalizedSubmission.transientConversationUrl;
  const response = buildWebChatRawResponse({
    request: input.request,
    runtimeName: input.runtimeName,
    providerUrl: input.providerUrl,
    sourcePageUrlBeforeFeed: null,
    extracted: {
      status: "success",
      message: "Recovered the exact generated image assistant turn.",
      answerText: `generated_image:${generatedImage.sha256}`,
      pageUrl: conversationUrl,
    },
    answerText: `generated_image:${generatedImage.sha256}`,
    modelIdentityProof: legacyIdentityProof(execution),
    providerExecutionProfileProof: execution.providerExecutionProfileProof,
    conversationTitleProof,
    uploadedFiles: execution.resumeUploadedFiles,
    ...(execution.resumeAttachmentUploadProof
      ? { attachmentUploadProof: execution.resumeAttachmentUploadProof } : {}),
    outputRefs: [generatedImage.artifactRef],
    outputArtifacts: [generatedImage],
    managedParallelExecution: true,
    forkActionProof: execution.resumeForkActionProof,
    submissionProof: finalizedSubmission,
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

export const resumeSubmittedWebChatConversation = async (
  input: ResumeConversationInput,
): Promise<AiProviderRawResponse> => {
  await verifyResumableTurn(input);
  const execution = input.context.webChatExecution!;
  const submission = execution.resumeSubmission!;
  if (input.request.expectedOutputKind === "generated_image") {
    return resumeGeneratedImageConversation(input, execution, submission);
  }
  const conversation = await readResumedConversation({
    requestInput: input,
    execution,
    submission,
  });
  const finalizedSubmission = await captureWebChatSubmissionProof({
    ...input,
    previousAssistantCount: submission.previousAssistantCount,
    previousUserMessageCount: submission.previousUserMessageCount,
    ...(execution.resumeForkActionProof?.childConversationUrl
      ? { initialConversationUrl: execution.resumeForkActionProof.childConversationUrl } : {}),
    requireCanonical: true,
  });
  await execution.onConversationCanonicalized(finalizedSubmission);
  const finalSubmission = { ...finalizedSubmission, submittedAt: submission.submittedAt };
  const conversationTitleProof = await finalizeWebChatSessionAfterResult({
    browser: input.browser,
    context: input.context,
    request: input.request,
    submission: finalSubmission,
  });
  const response = await buildResumedResponse({
    requestInput: input,
    execution,
    submission: finalSubmission,
    conversation,
    conversationTitleProof,
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
