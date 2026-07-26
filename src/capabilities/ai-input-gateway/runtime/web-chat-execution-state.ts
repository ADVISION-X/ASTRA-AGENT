import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { buildHumanReadableSystemChatTitle } from "./web-chat-system-title.js";

export type WebChatExecutionStatus =
  | "waiting_for_capacity"
  | "waiting_for_submit_slot"
  | "submitting"
  | "submitted_transient"
  | "conversation_canonicalized"
  | "waiting_provider"
  | "response_captured"
  | "review_required"
  | "failed";

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
  responseHash: string | null;
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

export const startOrResumeWebChatExecution = async (input: {
  dataDir: string;
  executionId: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  promptContractId: string;
  inputHash: string;
  textPrompt: string;
}): Promise<{ record: WebChatExecutionRecord; resume: boolean }> => {
  const existing = await readWebChatExecution(input.dataDir, input.executionId);
  if (existing) {
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
      || existing.status === "review_required"
    ) {
      if (!existing.submission) {
        throw new Error("review_required: submitted web-chat execution is missing its durable submission proof.");
      }
      return { record: existing, resume: true };
    }
    if (existing.status === "response_captured") {
      throw new Error("review_required: captured web-chat execution must be rehydrated from its persisted raw output.");
    }
    if (existing.status !== "failed") {
      return { record: existing, resume: false };
    }
    throw new Error(`review_required: web-chat execution is terminal: ${existing.status}`);
  }
  const now = new Date().toISOString();
  const turnMarker = `GRASSEYE_TURN_${randomUUID().replaceAll("-", "")}`;
  const systemChatTitle = input.providerKind === "gpt-web-chat"
    ? buildHumanReadableSystemChatTitle({
        promptContractId: input.promptContractId,
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
    responseHash: null,
    createdAt: now,
    updatedAt: now,
  };
  await atomicWrite(statePath(input.dataDir, input.executionId), record);
  return { record, resume: false };
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
