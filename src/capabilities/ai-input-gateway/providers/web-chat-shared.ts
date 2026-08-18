import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type {
  AiProviderAdapterContext,
  AiProviderRawResponse,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatForkActionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { openProviderPage } from "./web-chat-open.js";
import { startChatGptAcknowledgementWatcher } from "./web-chat-rate-limit-dialog.js";
import { submitPromptViaClipboard } from "./web-chat-submit.js";
import { attachApprovedWebChatFilesOnce } from "../children/attach-approved-web-chat-files-once.js";
import {
  assertActiveProviderPage,
  buildWebChatRawResponse,
  cleanupProviderWorkspaceAfterResponse,
  persistWorkspaceAfterResponse,
  readActivePageUrl,
  requireBrowser,
} from "./web-chat-shared-support.js";
import { captureWebChatResponseArtifacts } from "./web-chat-response-artifacts.js";
import { captureChatGptGeneratedImage } from "./web-chat-generated-image-capture.js";
import { ensureProviderWorkspaceFocused } from "./web-chat-workspace.js";
import { restoreAfterWebChatFeed } from "./web-chat-recovery.js";
import { captureWebChatSubmissionProof } from "./web-chat-turn-identity.js";
import {
  extractWebChatConversation,
} from "./web-chat-response-capture.js";
import { resumeSubmittedWebChatConversation } from "./web-chat-resume.js";
import {
  readPreSubmitConversationState,
} from "./web-chat-pre-submit-state.js";
import {
  selectWebChatModelAndReasoning,
} from "./web-chat-model-identity.js";

const submitWebChatPrompt = async (input: {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  previousAssistantCount: number;
  previousUserMessageCount: number;
  initialConversationUrl?: string;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
}): Promise<Awaited<ReturnType<typeof submitPromptViaClipboard>>> => {
  await assertActiveProviderPage({
    browser: input.browser,
    providerUrl: input.providerUrl,
    phase: "prompt submit",
    ...(input.context.abortSignal
      ? { abortSignal: input.context.abortSignal }
      : {}),
  });
  return submitPromptViaClipboard({
    browser: input.browser,
    request: input.request,
    context: input.context,
    previousAssistantCount: input.previousAssistantCount,
    previousUserMessageCount: input.previousUserMessageCount,
    ...(input.initialConversationUrl
      ? { initialConversationUrl: input.initialConversationUrl } : {}),
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
  });
};

type OpenedWebChatConversationInput = {
  browser: BrowserTargetSession;
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
  sourcePageUrlBeforeFeed: string | null;
  forkActionProof?: WebChatForkActionProof | null;
};

type PreparedWebChatConversation = {
  previousAssistantCount: number;
  previousUserMessageCount: number;
  previousAnswerText: string | null;
  modelIdentityProof: AiProviderRawResponse["modelIdentityProof"];
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
};

const prepareWebChatAttachments = async (input: {
  readonly opened: OpenedWebChatConversationInput;
  readonly modelIdentityProof: AiProviderRawResponse["modelIdentityProof"];
  readonly phase: string;
}): Promise<PreparedWebChatConversation> => {
  const opened = input.opened;
  await assertActiveProviderPage({
    browser: opened.browser,
    providerUrl: opened.providerUrl,
    phase: input.phase,
    ...(opened.context.abortSignal
      ? { abortSignal: opened.context.abortSignal }
      : {}),
  });
  const preSubmit = await readPreSubmitConversationState({
    browser: opened.browser,
    request: opened.request,
    context: opened.context,
    providerUrl: opened.providerUrl,
  });
  const attachmentResult = await attachApprovedWebChatFilesOnce({
    browser: opened.browser,
    request: opened.request,
    context: opened.context,
  });
  await ensureProviderWorkspaceFocused({
    ...opened,
    allowAnyProviderTab: false,
  });
  return {
    ...preSubmit,
    modelIdentityProof: input.modelIdentityProof,
    uploadedFiles: attachmentResult.uploadedFiles,
    attachmentUploadProof: attachmentResult.attachmentUploadProof,
  };
};

const prepareWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<PreparedWebChatConversation> => {
  await ensureProviderWorkspaceFocused({
    ...input,
    allowAnyProviderTab: false,
  });
  const modelIdentityProof = input.request.providerKind === "gpt-web-chat"
    && input.request.requestedReasoningEffort
    ? await selectWebChatModelAndReasoning({
      browser: input.browser,
      providerUrl: input.providerUrl,
      requestedReasoningEffort: input.request.requestedReasoningEffort,
    })
    : undefined;
  return prepareWebChatAttachments({
    opened: input,
    modelIdentityProof,
    phase: modelIdentityProof
      ? "pre-submit model identity confirmation"
      : "attachment upload",
  });
};

type CompletedWebChatResponseInput = {
  opened: OpenedWebChatConversationInput;
  preSubmit: Awaited<ReturnType<typeof prepareWebChatConversation>>;
  conversation: Awaited<ReturnType<typeof extractWebChatConversation>>;
  submission: Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null;
};

const buildProviderTranscript = (
  input: CompletedWebChatResponseInput,
  conversationUrl: string | null,
  finalizedSubmission: Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null,
): string => `${JSON.stringify({
  type: "assistant_message",
  providerKind: input.opened.request.providerKind,
  conversationUrl,
  turnMarker: finalizedSubmission?.turnMarker ?? null,
  text: input.conversation.answerText,
})}\n`;

const captureCompletedEvidence = async (input: {
  readonly completed: CompletedWebChatResponseInput;
  readonly conversationUrl: string | null;
  readonly finalizedSubmission: Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null;
}): Promise<{
  readonly providerTranscriptJsonl: string;
  readonly modelIdentityProof: AiProviderRawResponse["modelIdentityProof"];
  readonly htmlArtifact: Awaited<ReturnType<typeof captureWebChatResponseArtifacts>>["htmlArtifact"];
  readonly jsonArtifact: Awaited<ReturnType<typeof captureWebChatResponseArtifacts>>["jsonArtifact"];
  readonly generatedImage: Awaited<ReturnType<typeof captureChatGptGeneratedImage>>;
}> => {
  const providerTranscriptJsonl = buildProviderTranscript(
    input.completed,
    input.conversationUrl,
    input.finalizedSubmission,
  );
  const modelIdentityProof = input.completed.preSubmit.modelIdentityProof;
  const { htmlArtifact, jsonArtifact } = await captureWebChatResponseArtifacts({
    browser: input.completed.opened.browser,
    request: input.completed.opened.request,
    context: input.completed.opened.context,
    answerText: input.completed.conversation.answerText,
    conversationUrl: input.conversationUrl,
  });
  const generatedImage = await captureChatGptGeneratedImage({
    browser: input.completed.opened.browser,
    request: input.completed.opened.request,
    context: input.completed.opened.context,
  });
  return { providerTranscriptJsonl, modelIdentityProof, htmlArtifact, jsonArtifact, generatedImage };
};

const captureFinalizedSubmission = async (
  input: CompletedWebChatResponseInput,
): Promise<Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null> =>
  input.opened.context.webChatExecution
    ? captureWebChatSubmissionProof({
      browser: input.opened.browser,
      context: input.opened.context,
      request: input.opened.request,
      previousAssistantCount: input.preSubmit.previousAssistantCount,
      previousUserMessageCount: input.preSubmit.previousUserMessageCount,
      ...(input.opened.forkActionProof ? {
        initialConversationUrl: input.opened.forkActionProof.childConversationUrl,
      } : {}),
      requireCanonical: true,
    })
    : null;

const buildCompletedWebChatResponse = async (
  input: CompletedWebChatResponseInput,
): Promise<AiProviderRawResponse> => {
  const finalizedSubmission = await captureFinalizedSubmission(input);
  if (finalizedSubmission) {
    await input.opened.context.webChatExecution!.onConversationCanonicalized(
      finalizedSubmission,
    );
  }
  const conversationUrl =
    finalizedSubmission?.canonicalConversationUrl ??
    input.conversation.extracted.pageUrl ??
    null;
  const evidence = await captureCompletedEvidence({
    completed: input,
    conversationUrl,
    finalizedSubmission,
  });
  return buildWebChatRawResponse({
    request: input.opened.request,
    runtimeName: input.opened.runtimeName,
    providerUrl: input.opened.providerUrl,
    sourcePageUrlBeforeFeed: input.opened.sourcePageUrlBeforeFeed,
    extracted: conversationUrl
      ? { ...input.conversation.extracted, pageUrl: conversationUrl }
      : input.conversation.extracted,
    answerText: evidence.htmlArtifact?.htmlDocument
      ?? evidence.jsonArtifact?.jsonText
      ?? input.conversation.answerText,
    modelIdentityProof: evidence.modelIdentityProof,
    providerTranscriptJsonl: evidence.providerTranscriptJsonl,
    uploadedFiles: input.preSubmit.uploadedFiles,
    attachmentUploadProof: input.preSubmit.attachmentUploadProof,
    outputRefs: [evidence.htmlArtifact?.outputRef, evidence.jsonArtifact?.outputRef,
      evidence.generatedImage?.artifactRef].filter((ref): ref is string => Boolean(ref)),
    outputArtifacts: evidence.generatedImage ? [evidence.generatedImage] : [],
    managedParallelExecution: Boolean(input.opened.context.webChatExecution),
    forkActionProof: input.opened.forkActionProof,
    submissionProof: finalizedSubmission,
  });
};

const executeGeneratedImageConversation = async (input: {
  opened: OpenedWebChatConversationInput;
  preSubmit: Awaited<ReturnType<typeof prepareWebChatConversation>>;
  capturedSubmission: Awaited<ReturnType<typeof captureWebChatSubmissionProof>> | null;
}): Promise<AiProviderRawResponse> => {
  const generatedImage = await captureChatGptGeneratedImage({
    browser: input.opened.browser,
    request: input.opened.request,
    context: input.opened.context,
  });
  if (!generatedImage) {
    throw new Error("review_required: generated image artifact was not captured");
  }
  const finalizedSubmission = await captureFinalizedSubmission({
    opened: input.opened,
    preSubmit: input.preSubmit,
    conversation: {
      answerText: `generated_image:${generatedImage.sha256}`,
      extracted: {
        status: "success",
        message: "Captured the exact generated image assistant turn.",
        answerText: `generated_image:${generatedImage.sha256}`,
        pageUrl: input.capturedSubmission?.canonicalConversationUrl
          ?? input.capturedSubmission?.transientConversationUrl
          ?? input.opened.providerUrl,
      },
    },
    submission: input.capturedSubmission,
  });
  if (finalizedSubmission && input.opened.context.webChatExecution) {
    await input.opened.context.webChatExecution.onConversationCanonicalized(
      finalizedSubmission,
    );
  }
  const conversationUrl = finalizedSubmission?.canonicalConversationUrl
    ?? input.capturedSubmission?.canonicalConversationUrl
    ?? input.capturedSubmission?.transientConversationUrl
    ?? input.opened.providerUrl;
  return buildWebChatRawResponse({
    request: input.opened.request,
    runtimeName: input.opened.runtimeName,
    providerUrl: input.opened.providerUrl,
    sourcePageUrlBeforeFeed: input.opened.sourcePageUrlBeforeFeed,
    extracted: {
      status: "success",
      message: "Captured the exact generated image assistant turn.",
      answerText: `generated_image:${generatedImage.sha256}`,
      pageUrl: conversationUrl,
    },
    answerText: `generated_image:${generatedImage.sha256}`,
    uploadedFiles: input.preSubmit.uploadedFiles,
    attachmentUploadProof: input.preSubmit.attachmentUploadProof,
    outputRefs: [generatedImage.artifactRef],
    outputArtifacts: [generatedImage],
    managedParallelExecution: Boolean(input.opened.context.webChatExecution),
    forkActionProof: input.opened.forkActionProof,
    submissionProof: finalizedSubmission ?? input.capturedSubmission,
  });
};

const executeWebChatConversation = async (
  input: OpenedWebChatConversationInput,
): Promise<AiProviderRawResponse> => {
  const preSubmit = await prepareWebChatConversation(input);
  await ensureProviderWorkspaceFocused({
    ...input,
    allowAnyProviderTab: false,
  });
  const capturedSubmission = await submitWebChatPrompt({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    previousAssistantCount: preSubmit.previousAssistantCount,
    previousUserMessageCount: preSubmit.previousUserMessageCount,
    ...(input.forkActionProof
      ? { initialConversationUrl: input.forkActionProof.childConversationUrl }
      : {}),
    uploadedFiles: preSubmit.uploadedFiles,
    attachmentUploadProof: preSubmit.attachmentUploadProof,
  });
  if (input.request.expectedOutputKind === "generated_image") {
    return executeGeneratedImageConversation({
      opened: input,
      preSubmit,
      capturedSubmission,
    });
  }
  const conversation = await extractWebChatConversation({
    browser: input.browser,
    request: input.request,
    context: input.context,
    providerUrl: input.providerUrl,
    previousAssistantCount: preSubmit.previousAssistantCount,
    previousAnswerText: preSubmit.previousAnswerText,
  });
  if (input.context.webChatExecution) {
    await input.context.webChatExecution.onResponseCaptured({
      answerText: conversation.answerText,
      pageUrl:
        conversation.extracted.pageUrl
        ?? capturedSubmission?.canonicalConversationUrl
        ?? capturedSubmission?.transientConversationUrl
        ?? input.providerUrl,
    });
  }
  return buildCompletedWebChatResponse({
    opened: input,
    preSubmit,
    conversation,
    submission: capturedSubmission,
  });
};

const executeOpenedWebChatAdapter = async (
  input: OpenedWebChatConversationInput,
): Promise<AiProviderRawResponse> => {
  const response = await executeWebChatConversation(input);
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

export const runWebChatAdapter = async (input: {
  request: AiFeedInput;
  context: AiProviderAdapterContext;
  providerUrl: string;
  runtimeName: string;
}): Promise<AiProviderRawResponse> => {
  const browser = requireBrowser(input.context);
  if (input.context.webChatExecution?.resumeSubmission) {
    return resumeSubmittedWebChatConversation({
      ...input,
      browser,
    });
  }
  const sourcePageUrlBeforeFeed = input.context.webChatExecution
    ? null
    : await readActivePageUrl(browser);
  let response: AiProviderRawResponse | null = null;
  const forkActionProof = await openProviderPage({
    browser,
    providerUrl: input.providerUrl,
    runtimeName: input.runtimeName,
    context: input.context,
    request: input.request,
  });
  const chatGptAcknowledgementWatcher = startChatGptAcknowledgementWatcher({
    browser: input.context.webChatExecution?.globalBrowser ?? browser,
    request: input.request,
    context: input.context,
  });
  try {
    response = await executeOpenedWebChatAdapter({
      browser,
      request: input.request,
      context: input.context,
      providerUrl: input.providerUrl,
      runtimeName: input.runtimeName,
      sourcePageUrlBeforeFeed,
      forkActionProof,
    });
    return response;
  } finally {
    let watcherFailure: unknown = null;
    try {
      await chatGptAcknowledgementWatcher?.stop();
    } catch (error) {
      watcherFailure ??= error;
    }
    await restoreAfterWebChatFeed({
      browser,
      context: input.context,
      providerUrl: input.providerUrl,
      request: input.request,
      sourcePageUrlBeforeFeed,
      response,
    });
    if (watcherFailure) throw watcherFailure;
  }
};
