import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiTaskLabelKey } from "../schema.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import { buildHumanReadableSystemChatTitle } from "./web-chat-system-title.js";
import type { WebChatResponseCheckpoint } from "./web-chat-response-checkpoint.js";

export type WebChatExecutionStatus =
  | "waiting_for_capacity"
  | "waiting_for_submit_slot"
  | "submitting"
  | "submitted_transient"
  | "conversation_canonicalized"
  | "waiting_provider"
  | "response_checkpointed"
  | "recovery_pending"
  | "response_captured"
  | "review_required"
  | "failed";

export type WebChatExecutionFailure = {
  occurredAt: string;
  attemptId: string;
  phase: WebChatExecutionStatus;
  classification: "recovery_pending" | "review_required" | "failed";
  recoverable: boolean;
  reason: string;
};

export type WebChatExecutionRecord = {
  schemaVersion: "web-chat-execution-v2";
  executionId: string;
  attemptId: string;
  status: WebChatExecutionStatus;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  inputHash: string;
  turnMarker: string;
  submittedPromptHash: string;
  systemChatTitle: string | null;
  capacitySlot: number | null;
  submission: WebChatSubmissionProof | null;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof | null;
  responseCheckpoint: WebChatResponseCheckpoint | null;
  responseHash: string | null;
  failures: WebChatExecutionFailure[];
  createdAt: string;
  updatedAt: string;
};

const safeExecutionKey = (executionId: string): string =>
  createHash("sha256").update(executionId).digest("hex");

const statePath = (dataDir: string, executionId: string): string =>
  path.join(
    dataDir,
    "runtime-data",
    "ai-input-gateway",
    "web-chat-executions",
    `${safeExecutionKey(executionId)}.json`,
  );

const atomicWrite = async (filePath: string, value: WebChatExecutionRecord): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
};

export const readWebChatExecution = async (
  dataDir: string,
  executionId: string,
): Promise<WebChatExecutionRecord | null> => {
  try {
    const parsed = JSON.parse(await readFile(statePath(dataDir, executionId), "utf8")) as Partial<WebChatExecutionRecord>;
    if (parsed.schemaVersion !== "web-chat-execution-v2") {
      throw new Error("review_required: legacy web-chat execution state cannot enter the single-tab named-chat runtime.");
    }
    return parsed as WebChatExecutionRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

type StartWebChatExecutionInput = {
  dataDir: string;
  executionId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  taskLabelKey: AiTaskLabelKey;
  inputHash: string;
  textPrompt: string;
};

type StartWebChatExecutionResult = {
  record: WebChatExecutionRecord;
  resume: boolean;
};

const resumeExistingWebChatExecution = async (
  input: StartWebChatExecutionInput,
  existing: WebChatExecutionRecord,
): Promise<StartWebChatExecutionResult> => {
  const expectedSubmittedPromptHash = hashSubmittedPrompt(
    buildInternallyMarkedPrompt(input.textPrompt, existing.turnMarker),
  );
  if (
    existing.providerKind !== input.providerKind
    || existing.inputHash !== input.inputHash
    || existing.submittedPromptHash !== expectedSubmittedPromptHash
  ) {
    throw new Error("review_required: persisted web-chat execution identity does not match the requested feed.");
  }
  if (
    existing.status === "submitted_transient"
    || existing.status === "conversation_canonicalized"
    || existing.status === "waiting_provider"
    || existing.status === "response_checkpointed"
    || existing.status === "review_required"
  ) {
    if (!existing.submission) {
      throw new Error("review_required: submitted web-chat execution is missing its durable submission proof.");
    }
    return { record: existing, resume: true };
  }
  if (existing.status === "recovery_pending") {
    return { record: existing, resume: Boolean(existing.submission) };
  }
  if (existing.status === "response_captured") {
    throw new Error("review_required: captured web-chat execution must be rehydrated from its persisted raw output.");
  }
  if (existing.status !== "failed") {
    return { record: existing, resume: false };
  }
  const lastFailure = existing.failures.at(-1);
  if (
    !existing.submission
    && lastFailure
    && classifyWebChatFailure(new Error(lastFailure.reason), false) === "recovery_pending"
  ) {
    return {
      record: await updateWebChatExecution({
        dataDir: input.dataDir,
        record: existing,
        patch: { status: "recovery_pending" },
      }),
      resume: false,
    };
  }
  throw new Error(`review_required: web-chat execution is terminal: ${existing.status}`);
};

const createWebChatExecution = async (
  input: StartWebChatExecutionInput,
): Promise<StartWebChatExecutionResult> => {
  const now = new Date().toISOString();
  const turnMarker = `GRASSEYE_TURN_${randomUUID().replaceAll("-", "")}`;
  const systemChatTitle = input.providerKind === "gpt-web-chat"
    ? buildHumanReadableSystemChatTitle({
        labelKey: input.taskLabelKey,
        executionId: input.executionId,
        turnMarker,
        createdAt: now,
      })
    : null;
  const record: WebChatExecutionRecord = {
    schemaVersion: "web-chat-execution-v2",
    executionId: input.executionId,
    attemptId: `web-chat-attempt:${randomUUID()}`,
    status: "waiting_for_capacity",
    providerKind: input.providerKind,
    inputHash: input.inputHash,
    turnMarker,
    submittedPromptHash: hashSubmittedPrompt(buildInternallyMarkedPrompt(input.textPrompt, turnMarker)),
    systemChatTitle,
    capacitySlot: null,
    submission: null,
    uploadedFiles: [],
    attachmentUploadProof: null,
    responseCheckpoint: null,
    responseHash: null,
    failures: [],
    createdAt: now,
    updatedAt: now,
  };
  await atomicWrite(statePath(input.dataDir, input.executionId), record);
  return { record, resume: false };
};

export const startOrResumeWebChatExecution = async (
  input: StartWebChatExecutionInput,
): Promise<StartWebChatExecutionResult> => {
  const existing = await readWebChatExecution(input.dataDir, input.executionId);
  return existing
    ? await resumeExistingWebChatExecution(input, existing)
    : createWebChatExecution(input);
};

export const updateWebChatExecution = async (input: {
  dataDir: string;
  record: WebChatExecutionRecord;
  patch: Partial<Omit<WebChatExecutionRecord, "schemaVersion" | "executionId" | "attemptId" | "createdAt">>;
}): Promise<WebChatExecutionRecord> => {
  const next: WebChatExecutionRecord = {
    ...input.record,
    ...input.patch,
    updatedAt: new Date().toISOString(),
  };
  await atomicWrite(statePath(input.dataDir, next.executionId), next);
  return next;
};

export const buildInternallyMarkedPrompt = (textPrompt: string, turnMarker: string): string =>
  `${textPrompt}\n\n[INTERNAL_TRANSPORT_MARKER:${turnMarker}]`;

export const hashSubmittedPrompt = (textPrompt: string): string =>
  `sha256:${createHash("sha256").update(textPrompt).digest("hex")}`;
