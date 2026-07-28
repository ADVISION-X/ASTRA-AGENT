import { createHash } from "node:crypto";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderUploadedFileProof, WebChatAttachmentUploadProof, WebChatExecutionContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiInputGatewayProgress } from "../contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  acquireWebChatBrowserMutationLease,
  acquireWebChatCapacityLease,
  registerPendingWebChatSubmission,
  type WebChatRuntimeLease,
} from "./web-chat-concurrency-lease.js";
import { classifyWebChatFailure, webChatFailureReason } from "../failure-classification.js";
import { buildInternallyMarkedPrompt, readWebChatExecution, startOrResumeWebChatExecution, updateWebChatExecution, type WebChatExecutionFailure, type WebChatExecutionRecord } from "./web-chat-execution-state.js";
import { persistWebChatResponseCheckpoint } from "./web-chat-response-checkpoint.js";
import { createSingleTabWebChatBrowser, type SingleTabWebChatBrowser } from "./web-chat-single-tab-browser.js";

type ManagedWebChatInput = {
  request: AiFeedInput;
  dataDir: string;
  transport: "api" | "web-chat";
  browser?: BrowserController;
  signal?: AbortSignal;
  executionId?: string;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
  onProgress?: (progress: AiInputGatewayProgress) => Promise<void>;
};

export type ManagedWebChatExecution = {
  request: AiFeedInput;
  browser?: BrowserController;
  webChatExecution?: WebChatExecutionContext;
  providerLeaseId: string | null;
  markResponse(rawText: string): Promise<void>;
  markFailure(error: unknown): Promise<void>;
  release(): Promise<void>;
};

type ActiveExecutionState = {
  record: WebChatExecutionRecord;
  capacityLease: WebChatRuntimeLease;
  initialMutationLease: WebChatRuntimeLease | null;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
  releasePendingSubmission: (() => void) | null;
};

type BuildExecutionContextInput = {
  source: ManagedWebChatInput;
  getRecord(): WebChatExecutionRecord;
  setRecord(record: WebChatExecutionRecord): void;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
  releasePendingSubmission(): void;
};

const resolveWebChatProviderKind = (request: AiFeedInput): "gpt-web-chat" | "gemini-web-chat" => {
  if (request.providerKind !== "gpt-web-chat" && request.providerKind !== "gemini-web-chat") {
    throw new Error("review_required: web-chat transport requires one web-chat provider kind.");
  }
  return request.providerKind;
};

const executionIdFor = (input: ManagedWebChatInput, inputHash: string): string => input.executionId ?? [input.request.providerKind, input.request.missionId ?? "mission", input.request.runId ?? input.request.roundId ?? inputHash, input.request.promptPackageId].join(":");

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

const buildSubmissionCallbacks = (
  input: BuildExecutionContextInput,
  update: ExecutionUpdater,
): Pick<
  WebChatExecutionContext,
  "onSubmissionObserved" | "onSubmitted" | "onConversationCanonicalized"
> => ({
  onSubmissionObserved: async ({ submission, uploadedFiles, attachmentUploadProof }) => {
    await update({
      status: submission.canonicalConversationUrl
        ? "conversation_canonicalized"
        : "submitted_transient",
      submission,
      uploadedFiles,
      attachmentUploadProof,
    });
    input.singleTabBrowser?.bindObservedConversation(submission);
  },
  onSubmitted: async ({ submission, uploadedFiles, attachmentUploadProof }) => {
    await update({
      status: submission.canonicalConversationUrl
        ? "conversation_canonicalized"
        : "submitted_transient",
      submission,
      uploadedFiles,
      attachmentUploadProof,
    });
    await update({ status: "waiting_provider" });
    input.singleTabBrowser?.bindConversationIdentity(submission);
    await input.singleTabBrowser?.releaseInitialMutationLease();
    input.releasePendingSubmission();
    await input.source.onAttachmentUploadCompleted?.(attachmentUploadProof);
    await reportProgress(input.source, "waiting_provider");
  },
  onConversationCanonicalized: (submission) => {
    const currentRecord = input.getRecord();
    const current = currentRecord.submission;
    return update({
      status: currentRecord.responseCheckpoint
        ? "response_checkpointed"
        : "conversation_canonicalized",
      submission: current
        ? {
            ...submission,
            systemChatTitle:
              submission.systemChatTitle ?? current.systemChatTitle,
            observedAutoChatTitle:
              submission.observedAutoChatTitle ?? current.observedAutoChatTitle,
            chatTitleVerifiedAt:
              submission.chatTitleVerifiedAt ?? current.chatTitleVerifiedAt,
            submittedAt: current.submittedAt,
          }
        : submission,
    });
  },
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
    systemChatTitle: record.systemChatTitle,
    turnMarker: record.turnMarker,
    submittedPromptHash: record.submittedPromptHash,
    resumeSubmission: input.resume ? record.submission : null,
    resumeUploadedFiles: input.resume ? record.uploadedFiles : [],
    resumeAttachmentUploadProof: input.resume ? record.attachmentUploadProof : null,
    resumeResponseCheckpoint: input.resume ? record.responseCheckpoint ?? null : null,
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

const prepareActiveBrowser = async (input: {
  source: ManagedWebChatInput;
  record: WebChatExecutionRecord;
  resume: boolean;
}): Promise<{
  record: WebChatExecutionRecord;
  initialMutationLease: WebChatRuntimeLease | null;
  singleTabBrowser: SingleTabWebChatBrowser | null;
}> => {
  if (!input.source.browser) {
    return {
      record: input.record,
      initialMutationLease: null,
      singleTabBrowser: null,
    };
  }
  let record = input.record;
  let initialMutationLease: WebChatRuntimeLease | null = null;
  try {
    if (!input.resume) {
      initialMutationLease = await acquireWebChatBrowserMutationLease({
        dataDir: input.source.dataDir,
        timeoutMs: input.source.request.timeoutMs,
        ...(input.source.signal ? { signal: input.source.signal } : {}),
      });
      record = await updateWebChatExecution({
        dataDir: input.source.dataDir,
        record,
        patch: { status: "submitting" },
      });
      await reportProgress(input.source, "submitting");
    }
    const singleTabBrowser = createSingleTabWebChatBrowser({
      base: input.source.browser,
      dataDir: input.source.dataDir,
      executionId: record.executionId,
      providerKind: record.providerKind,
      systemChatTitle: record.systemChatTitle,
      turnMarker: record.turnMarker,
      timeoutMs: input.source.request.timeoutMs,
      initialMutationLease,
      resumeSubmission: input.resume ? record.submission : null,
      ...(input.source.signal ? { signal: input.source.signal } : {}),
    });
    return { record, initialMutationLease: null, singleTabBrowser };
  } catch (error) {
    await initialMutationLease?.release();
    throw error;
  }
};

const startActiveExecution = async (input: ManagedWebChatInput, inputHash: string): Promise<ActiveExecutionState> => {
  const providerKind = resolveWebChatProviderKind(input.request);
  const started = await startOrResumeWebChatExecution({
    dataDir: input.dataDir,
    executionId: executionIdFor(input, inputHash),
    providerKind,
    taskLabelKey: input.request.taskIdentity.labelKey,
    inputHash,
    textPrompt: input.request.textPrompt,
  });
  let record = started.record;
  await reportProgress(input, "waiting_for_capacity");
  const capacityLease = await acquireWebChatCapacityLease({
    dataDir: input.dataDir,
    timeoutMs: input.request.timeoutMs,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  let releasePendingSubmission = started.resume
    ? null
    : registerPendingWebChatSubmission(input.dataDir, record.executionId);
  try {
    record = await updateWebChatExecution({
      dataDir: input.dataDir,
      record,
      patch: {
        capacitySlot: capacityLease.slot,
        status: started.resume ? "waiting_provider" : "waiting_for_submit_slot",
      },
    });
    await reportProgress(
      input,
      started.resume ? "waiting_provider" : "waiting_for_submit_slot",
    );
    const browserState = await prepareActiveBrowser({
      source: input,
      record,
      resume: started.resume,
    });
    record = browserState.record;
    return {
      record,
      capacityLease,
      initialMutationLease: browserState.initialMutationLease,
      singleTabBrowser: browserState.singleTabBrowser,
      resume: started.resume,
      releasePendingSubmission,
    };
  } catch (error) {
    releasePendingSubmission?.();
    releasePendingSubmission = null;
    await capacityLease.release();
    throw error;
  }
};

const buildActiveExecution = (input: ManagedWebChatInput, state: ActiveExecutionState): ManagedWebChatExecution => {
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
    request: state.resume
      ? input.request
      : {
          ...input.request,
          textPrompt: buildInternallyMarkedPrompt(input.request.textPrompt, state.record.turnMarker),
        },
    ...(state.singleTabBrowser ? { browser: state.singleTabBrowser.browser } : {}),
    webChatExecution,
    providerLeaseId: state.capacityLease.leaseId,
    async markResponse(rawText) {
      state.record = await updateWebChatExecution({
        dataDir: input.dataDir,
        record: state.record,
        patch: {
          status: "response_captured",
          responseHash: `sha256:${createHash("sha256").update(rawText).digest("hex")}`,
        },
      });
      await reportProgress(input, "response_captured");
    },
    async markFailure(error) {
      const classification: WebChatExecutionFailure["classification"] =
        classifyWebChatFailure(error, Boolean(state.record.submission));
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
    },
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
      return buildActiveExecution(input, await startActiveExecution(input, inputHash));
    } catch (error) {
      const executionId = executionIdFor(input, inputHash);
      const record = await readWebChatExecution(input.dataDir, executionId);
      if (record) {
        const classification = classifyWebChatFailure(
          error,
          Boolean(record.submission),
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
    markResponse: async () => undefined,
    markFailure: async () => undefined,
    release: async () => undefined,
  };
};
