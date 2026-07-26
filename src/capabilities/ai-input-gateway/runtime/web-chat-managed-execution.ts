import { createHash } from "node:crypto";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { AiProviderUploadedFileProof, WebChatAttachmentUploadProof, WebChatExecutionContext } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import { acquireWebChatBrowserMutationLease, acquireWebChatCapacityLease, type WebChatRuntimeLease } from "./web-chat-concurrency-lease.js";
import { buildInternallyMarkedPrompt, startOrResumeWebChatExecution, updateWebChatExecution, type WebChatExecutionRecord } from "./web-chat-execution-state.js";
import { createSingleTabWebChatBrowser, type SingleTabWebChatBrowser } from "./web-chat-single-tab-browser.js";

type ManagedWebChatInput = {
  request: AiFeedInput;
  dataDir: string;
  transport: "api" | "web-chat";
  browser?: BrowserController;
  signal?: AbortSignal;
  executionId?: string;
  onAttachmentUploadCompleted?: (proof: WebChatAttachmentUploadProof) => Promise<void>;
};

export type ManagedWebChatExecution = {
  request: AiFeedInput;
  browser?: BrowserController;
  webChatExecution?: WebChatExecutionContext;
  providerLeaseId: string | null;
  markResponse(rawText: string): Promise<void>;
  markFailure(reviewRequired: boolean): Promise<void>;
  release(): Promise<void>;
};

type ActiveExecutionState = {
  record: WebChatExecutionRecord;
  capacityLease: WebChatRuntimeLease;
  initialMutationLease: WebChatRuntimeLease | null;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
};

type BuildExecutionContextInput = {
  source: ManagedWebChatInput;
  getRecord(): WebChatExecutionRecord;
  setRecord(record: WebChatExecutionRecord): void;
  singleTabBrowser: SingleTabWebChatBrowser | null;
  resume: boolean;
};

const resolveWebChatProviderKind = (request: AiFeedInput): "gpt-web-chat" | "gemini-web-chat" => {
  if (request.providerKind !== "gpt-web-chat" && request.providerKind !== "gemini-web-chat") {
    throw new Error("review_required: web-chat transport requires one web-chat provider kind.");
  }
  return request.providerKind;
};

const executionIdFor = (input: ManagedWebChatInput, inputHash: string): string => input.executionId ?? [input.request.providerKind, input.request.missionId ?? "mission", input.request.runId ?? input.request.roundId ?? inputHash, input.request.promptPackageId].join(":");

const buildExecutionContext = (input: BuildExecutionContextInput): WebChatExecutionContext => {
  const record = input.getRecord();
  const update = async (patch: Parameters<typeof updateWebChatExecution>[0]["patch"]) => {
    const updated = await updateWebChatExecution({
      dataDir: input.source.dataDir,
      record: input.getRecord(),
      patch,
    });
    input.setRecord(updated);
  };
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
    onSubmissionObserved: async ({ submission, uploadedFiles, attachmentUploadProof }) => {
      await update({
        status: submission.canonicalConversationUrl ? "conversation_canonicalized" : "submitted_transient",
        submission,
        uploadedFiles,
        attachmentUploadProof,
      });
      input.singleTabBrowser?.bindObservedConversation(submission);
    },
    onSubmitted: async ({ submission, uploadedFiles, attachmentUploadProof }) => {
      await update({
        status: submission.canonicalConversationUrl ? "conversation_canonicalized" : "submitted_transient",
        submission,
        uploadedFiles,
        attachmentUploadProof,
      });
      await update({ status: "waiting_provider" });
      input.singleTabBrowser?.bindConversationIdentity(submission);
      await input.singleTabBrowser?.releaseInitialMutationLease();
      await input.source.onAttachmentUploadCompleted?.(attachmentUploadProof);
    },
    onConversationCanonicalized: (submission) => {
      const current = input.getRecord().submission;
      return update({
        status: "conversation_canonicalized",
        submission: current
          ? {
              ...submission,
              systemChatTitle: submission.systemChatTitle ?? current.systemChatTitle,
              observedAutoChatTitle: submission.observedAutoChatTitle ?? current.observedAutoChatTitle,
              chatTitleVerifiedAt: submission.chatTitleVerifiedAt ?? current.chatTitleVerifiedAt,
              submittedAt: current.submittedAt,
            }
          : submission,
      });
    },
  };
};

const startActiveExecution = async (input: ManagedWebChatInput, inputHash: string): Promise<ActiveExecutionState> => {
  const providerKind = resolveWebChatProviderKind(input.request);
  const started = await startOrResumeWebChatExecution({
    dataDir: input.dataDir,
    executionId: executionIdFor(input, inputHash),
    providerKind,
    promptContractId: input.request.promptContractId,
    inputHash,
    textPrompt: input.request.textPrompt,
  });
  let record = started.record;
  const capacityLease = await acquireWebChatCapacityLease({
    dataDir: input.dataDir,
    timeoutMs: input.request.timeoutMs,
    ...(input.signal ? { signal: input.signal } : {}),
  });
  let initialMutationLease: WebChatRuntimeLease | null = null;
  let singleTabBrowser: SingleTabWebChatBrowser | null = null;
  try {
    record = await updateWebChatExecution({
      dataDir: input.dataDir,
      record,
      patch: {
        capacitySlot: capacityLease.slot,
        status: started.resume ? "waiting_provider" : "waiting_for_submit_slot",
      },
    });
    if (input.browser) {
      if (!started.resume) {
        initialMutationLease = await acquireWebChatBrowserMutationLease({
          dataDir: input.dataDir,
          timeoutMs: input.request.timeoutMs,
          ...(input.signal ? { signal: input.signal } : {}),
        });
        record = await updateWebChatExecution({
          dataDir: input.dataDir,
          record,
          patch: { status: "submitting" },
        });
      }
      singleTabBrowser = createSingleTabWebChatBrowser({
        base: input.browser,
        dataDir: input.dataDir,
        providerKind: record.providerKind,
        systemChatTitle: record.systemChatTitle,
        turnMarker: record.turnMarker,
        timeoutMs: input.request.timeoutMs,
        initialMutationLease,
        resumeSubmission: started.resume ? record.submission : null,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      initialMutationLease = null;
    }
    return {
      record,
      capacityLease,
      initialMutationLease,
      singleTabBrowser,
      resume: started.resume,
    };
  } catch (error) {
    await initialMutationLease?.release();
    await capacityLease.release();
    throw error;
  }
};

const buildActiveExecution = (input: ManagedWebChatInput, state: ActiveExecutionState): ManagedWebChatExecution => {
  const webChatExecution = buildExecutionContext({
    source: input,
    getRecord: () => state.record,
    setRecord: (next) => {
      state.record = next;
    },
    singleTabBrowser: state.singleTabBrowser,
    resume: state.resume,
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
    },
    async markFailure(reviewRequired) {
      state.record = await updateWebChatExecution({
        dataDir: input.dataDir,
        record: state.record,
        patch: { status: reviewRequired ? "review_required" : "failed" },
      }).catch(() => state.record);
    },
    async release() {
      await state.singleTabBrowser?.releaseInitialMutationLease();
      await state.initialMutationLease?.release();
      await state.capacityLease.release();
    },
  };
};

export const prepareManagedWebChatExecution = async (input: ManagedWebChatInput, inputHash: string): Promise<ManagedWebChatExecution> => {
  if (input.transport === "web-chat") {
    return buildActiveExecution(input, await startActiveExecution(input, inputHash));
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
