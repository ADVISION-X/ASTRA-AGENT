import { createHash } from "node:crypto";

import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { AiProviderUploadedFileProof, WebChatAttachmentUploadProof, WebChatExecutionContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiInputGatewayProgress } from "../contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  classifyWebChatFailure,
  type WebChatFailureClassification,
  webChatFailureReason,
} from "../failure-classification.js";
import {
  readWebChatExecution,
  updateWebChatExecution,
  type WebChatExecutionFailure,
  type WebChatExecutionRecord,
} from "./web-chat-execution-state.js";
import {
  assertWebChatCanonicalConversationBinding,
} from "./web-chat-canonical-binding.js";
import { persistWebChatResponseCheckpoint } from "./web-chat-response-checkpoint.js";
import type { SingleTabWebChatBrowser } from "./web-chat-single-tab-browser.js";
import {
  managedExecutionIdFor,
  startActiveExecution,
  type ActiveExecutionState,
} from "./web-chat-managed-execution-start.js";

export type ManagedWebChatInput = {
  request: AiFeedInput;
  dataDir: string;
  transport: "api" | "web-chat";
  browser?: BrowserTargetSession;
  runtimeLogger?: RuntimeLogger;
  signal?: AbortSignal;
  executionId?: string;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
};

export type ManagedWebChatExecution = {
  request: AiFeedInput;
  browser?: BrowserTargetSession;
  webChatExecution?: WebChatExecutionContext;
  providerLeaseId: string | null;
  durableSubmission(): WebChatExecutionRecord["submission"];
  markResponse(rawText: string): Promise<void>;
  markFailure(error: unknown): Promise<WebChatFailureClassification>;
  markPostProcessingFailure(error: unknown): Promise<void>;
  release(): Promise<void>;
};

type BuildExecutionContextInput = {
  source: ManagedWebChatInput;
  getRecord(): WebChatExecutionRecord;
  setRecord(record: WebChatExecutionRecord): void;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
  releasePendingSubmission(): void;
};

const reportProgress = (
  input: ManagedWebChatInput,
  phase: AiInputGatewayProgress["phase"],
): Promise<void> => input.onProgress?.({
  phase,
  occurredAt: new Date().toISOString(),
}) ?? Promise.resolve();

type ExecutionUpdater = (
  patch: Parameters<typeof updateWebChatExecution>[0]["patch"],
) => Promise<void>;

const createExecutionUpdater = (
  input: BuildExecutionContextInput,
): ExecutionUpdater => async (patch) => {
  const updated = await updateWebChatExecution({
    dataDir: input.source.dataDir,
    record: input.getRecord(),
    patch,
  });
  input.setRecord(updated);
};

const assertBinding = (
  input: BuildExecutionContextInput,
  submission: Parameters<WebChatExecutionContext["onConversationCanonicalized"]>[0],
): Promise<void> => assertWebChatCanonicalConversationBinding({
  dataDir: input.source.dataDir,
  executionId: input.getRecord().executionId,
  providerKind: input.getRecord().providerKind,
  canonicalConversationUrl: submission.canonicalConversationUrl,
  continuationConversationUrl: input.source.request.providerContinuationRef?.providerPageUrl ?? null,
});

const buildSubmissionObservedCallback = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): WebChatExecutionContext["onSubmissionObserved"] => async (observed) => {
  await assertBinding(input, observed.submission);
  await update({
    status: observed.submission.canonicalConversationUrl
      ? "conversation_canonicalized" : "submitted_transient",
    submission: observed.submission,
    uploadedFiles: observed.uploadedFiles,
    attachmentUploadProof: observed.attachmentUploadProof,
  });
  input.singleTabBrowser?.bindObservedConversation(observed.submission);
};

const buildSubmittedCallback = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): WebChatExecutionContext["onSubmitted"] => async (observed) => {
  await assertBinding(input, observed.submission);
  await update({
    status: observed.submission.canonicalConversationUrl
      ? "conversation_canonicalized" : "submitted_transient",
    submission: observed.submission,
    uploadedFiles: observed.uploadedFiles,
    attachmentUploadProof: observed.attachmentUploadProof,
  });
  await update({ status: "waiting_provider" });
  input.singleTabBrowser?.bindConversationIdentity(observed.submission);
  await input.singleTabBrowser?.releaseInitialMutationLease();
  input.releasePendingSubmission();
  await input.source.onAttachmentUploadCompleted?.(observed.attachmentUploadProof);
  await reportProgress(input.source, "waiting_provider");
};

const buildCanonicalizedCallback = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): WebChatExecutionContext["onConversationCanonicalized"] => async (submission) => {
  await assertBinding(input, submission);
  const record = input.getRecord();
  const current = record.submission;
  await update({
    status: record.responseCheckpoint ? "response_checkpointed" : "conversation_canonicalized",
    submission: current ? {
      ...submission,
      submittedAt: current.submittedAt,
    } : submission,
    forkActionProof: record.forkActionProof && submission.canonicalConversationUrl ? {
      ...record.forkActionProof,
      childConversationUrl: submission.canonicalConversationUrl,
    } : record.forkActionProof,
  });
};

const buildSubmissionCallbacks = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): Pick<
  WebChatExecutionContext,
  | "onSubmissionObserved"
  | "onSubmitted"
  | "onConversationCanonicalized"
  | "onForkActionObserved"
> => ({
  onForkActionObserved: async (proof) => update({ forkActionProof: proof }),
  onSubmissionObserved: buildSubmissionObservedCallback(input, update),
  onSubmitted: buildSubmittedCallback(input, update),
  onConversationCanonicalized: buildCanonicalizedCallback(input, update),
});

const buildResponseCheckpointCallback = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): Pick<WebChatExecutionContext, "onResponseCaptured"> => ({
  onResponseCaptured: async ({ answerText, pageUrl }) => {
    const checkpoint = await persistWebChatResponseCheckpoint({
      dataDir: input.source.dataDir,
      executionId: input.getRecord().executionId,
      answerText,
      pageUrl,
    });
    await update({
      status: "response_checkpointed",
      responseCheckpoint: checkpoint,
      responseHash: checkpoint.rawOutputHash,
    });
    await reportProgress(input.source, "response_checkpointed");
    return checkpoint;
  },
});

const buildExecutionContext = (input: BuildExecutionContextInput): WebChatExecutionContext => {
  const record = input.getRecord();
  const update = createExecutionUpdater(input);
  return {
    executionId: record.executionId,
    attemptId: record.attemptId,
    providerKind: record.providerKind,
    requestTextPrompt: input.source.request.textPrompt,
    turnMarker: record.turnMarker,
    submittedPromptHash: record.submittedPromptHash,
    resumeSubmission: input.resume ? record.submission : null,
    resumeUploadedFiles: input.resume ? record.uploadedFiles : [],
    resumeAttachmentUploadProof: input.resume ? record.attachmentUploadProof : null,
    resumeResponseCheckpoint: input.resume ? record.responseCheckpoint ?? null : null,
    resumeForkActionProof: input.resume ? record.forkActionProof : null,
    globalBrowser: input.singleTabBrowser?.globalBrowser ?? null,
    runExclusivePatrol: (operation) => {
      if (!input.singleTabBrowser) {
        throw new Error(
          "review_required: managed web-chat exclusive patrol is unavailable.",
        );
      }
      return input.singleTabBrowser.runExclusivePatrol(operation);
    },
    ...buildSubmissionCallbacks(input, update),
    ...buildResponseCheckpointCallback(input, update),
  };
};

const markActiveExecutionResponse = async (
  input: ManagedWebChatInput,
  state: ActiveExecutionState,
  rawText: string,
): Promise<void> => {
  state.record = await updateWebChatExecution({
    dataDir: input.dataDir,
    record: state.record,
    patch: {
      status: "response_captured",
      responseHash:
        `sha256:${createHash("sha256").update(rawText).digest("hex")}`,
    },
  });
  await reportProgress(input, "response_captured");
};

const markActiveExecutionFailure = async (
  input: ManagedWebChatInput,
  state: ActiveExecutionState,
  error: unknown,
): Promise<WebChatFailureClassification> => {
  const classification: WebChatExecutionFailure["classification"] =
    classifyWebChatFailure(
      error,
      Boolean(state.record.submission),
      state.record.failures.map((failure) => failure.reason),
    );
  const recoverable = classification === "recovery_pending";
  const reason = webChatFailureReason(error);
  state.record = await updateWebChatExecution({
    dataDir: input.dataDir,
    record: state.record,
    patch: {
      status: classification,
      failures: [
        ...(state.record.failures ?? []),
        {
          occurredAt: new Date().toISOString(),
          attemptId: state.record.attemptId,
          phase: state.record.status,
          classification,
          recoverable,
          reason: reason || "unknown web-chat execution failure",
        },
      ].slice(-20),
    },
  }).catch(() => state.record);
  if (recoverable) await reportProgress(input, "recovery_pending");
  return classification;
};

const markActivePostProcessingFailure = async (
  input: ManagedWebChatInput,
  state: ActiveExecutionState,
  error: unknown,
): Promise<void> => {
  const reason = webChatFailureReason(error);
  state.record = await updateWebChatExecution({
    dataDir: input.dataDir,
    record: state.record,
    patch: {
      status: "response_captured",
      failures: [
        ...(state.record.failures ?? []),
        {
          occurredAt: new Date().toISOString(),
          attemptId: state.record.attemptId,
          phase: state.record.status,
          classification: "recovery_pending" as const,
          recoverable: true,
          reason: `post_processing_after_response_publication: ${reason}`,
        },
      ].slice(-20),
    },
  }).catch(() => state.record);
};

const buildActiveExecution = (
  input: ManagedWebChatInput,
  state: ActiveExecutionState,
): ManagedWebChatExecution => {
  const releasePendingSubmission = (): void => {
    state.releasePendingSubmission?.();
    state.releasePendingSubmission = null;
  };
  const webChatExecution = buildExecutionContext({
    source: input,
    getRecord: () => state.record,
    setRecord: (next) => {
      state.record = next;
    },
    singleTabBrowser: state.singleTabBrowser,
    resume: state.resume,
    releasePendingSubmission,
  });
  return {
    request: input.request,
    ...(state.singleTabBrowser ? { browser: state.singleTabBrowser.browser } : {}),
    webChatExecution,
    providerLeaseId: state.capacityLease.leaseId,
    durableSubmission: () => state.record.submission,
    markResponse: (rawText) =>
      markActiveExecutionResponse(input, state, rawText),
    markFailure: (error) =>
      markActiveExecutionFailure(input, state, error),
    markPostProcessingFailure: (error) =>
      markActivePostProcessingFailure(input, state, error),
    async release() {
      releasePendingSubmission();
      await state.singleTabBrowser?.releaseInitialMutationLease();
      await state.initialMutationLease?.release();
      await state.capacityLease.release();
    },
  };
};

export const prepareManagedWebChatExecution = async (input: ManagedWebChatInput, inputHash: string): Promise<ManagedWebChatExecution> => {
  if (input.transport === "web-chat") {
    try {
      return buildActiveExecution(input, await startActiveExecution({
        source: input,
        inputHash,
        reportProgress: (phase) =>
          reportProgress(input, phase as AiInputGatewayProgress["phase"]),
      }));
    } catch (error) {
      const executionId = managedExecutionIdFor(input, inputHash);
      const record = await readWebChatExecution(input.dataDir, executionId);
      if (record) {
        const classification = classifyWebChatFailure(
          error,
          Boolean(record.submission),
          record.failures.map((failure) => failure.reason),
        );
        const recoverable = classification === "recovery_pending";
        await updateWebChatExecution({
          dataDir: input.dataDir,
          record,
          patch: {
            status: classification,
            failures: [
              ...(record.failures ?? []),
              {
                occurredAt: new Date().toISOString(),
                attemptId: record.attemptId,
                phase: record.status,
                classification,
                recoverable,
                reason: webChatFailureReason(error),
              },
            ].slice(-20),
          },
        });
        if (recoverable) await reportProgress(input, "recovery_pending");
      }
      throw error;
    }
  }
  return {
    request: input.request,
    ...(input.browser ? { browser: input.browser } : {}),
    providerLeaseId: null,
    durableSubmission: () => null,
    markResponse: async () => undefined,
    markFailure: async () => "failed",
    markPostProcessingFailure: async () => undefined,
    release: async () => undefined,
  };
};
