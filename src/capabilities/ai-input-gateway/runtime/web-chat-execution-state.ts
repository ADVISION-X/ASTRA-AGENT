import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
  WebChatForkActionProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import type { AiTaskLabelKey } from "../schema.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import {
  buildHumanReadableSystemChatTitle,
  resolveAiTaskLabel,
} from "./web-chat-system-title.js";
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

export type WebChatTitleRenameState = {
  status: "pending" | "verified" | "review_required";
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastFailureReason: string | null;
  verifiedAt: string | null;
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
  providerLeaseId: string | null;
  submission: WebChatSubmissionProof | null;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof | null;
  forkActionProof: WebChatForkActionProof | null;
  responseCheckpoint: WebChatResponseCheckpoint | null;
  responseHash: string | null;
  chatTitleRename: WebChatTitleRenameState | null;
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

const derivePersistedTitleRenameState = (
  parsed: Partial<WebChatExecutionRecord>,
): WebChatTitleRenameState | null => {
  if (parsed.chatTitleRename) return parsed.chatTitleRename;
  if (parsed.providerKind !== "gpt-web-chat" || !parsed.responseCheckpoint) {
    return null;
  }
  const verifiedAt = parsed.submission?.chatTitleVerifiedAt ?? null;
  return {
    status: verifiedAt ? "verified" : "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastFailureReason: null,
    verifiedAt,
  };
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
    return {
      ...(parsed as WebChatExecutionRecord),
      providerLeaseId: parsed.providerLeaseId ?? null,
      forkActionProof: parsed.forkActionProof ?? null,
      chatTitleRename: derivePersistedTitleRenameState(parsed),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

type StartWebChatExecutionInput = {
  dataDir: string;
  executionId: string;
  turnIdentitySeed?: string;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  taskLabelKey: AiTaskLabelKey;
  inputHash: string;
  textPrompt: string;
};

type StartWebChatExecutionResult = {
  record: WebChatExecutionRecord;
  resume: boolean;
};

const turnMarkerFor = (input: StartWebChatExecutionInput): string =>
  `GRASSEYE_TURN_${
    createHash("sha256")
      .update(
        input.turnIdentitySeed
        ?? `${input.executionId}\u0000${input.inputHash}`,
      )
      .digest("hex")
      .slice(0, 32)
  }`;

const restartUnsubmittedExecution = async (
  input: StartWebChatExecutionInput,
  existing: WebChatExecutionRecord,
): Promise<WebChatExecutionRecord> => {
  const now = new Date().toISOString();
  const turnMarker = turnMarkerFor(input);
  const next: WebChatExecutionRecord = {
    ...existing,
    attemptId: `web-chat-attempt:${randomUUID()}`,
    status: "recovery_pending",
    inputHash: input.inputHash,
    turnMarker,
    submittedPromptHash: hashSubmittedPrompt(
      buildInternallyMarkedPrompt(input.textPrompt, turnMarker),
    ),
    systemChatTitle: input.providerKind === "gpt-web-chat"
      ? buildHumanReadableSystemChatTitle({
          labelKey: input.taskLabelKey,
          executionId: input.executionId,
          turnMarker,
          createdAt: now,
        })
      : null,
    capacitySlot: null,
    providerLeaseId: null,
    submission: null,
    uploadedFiles: [],
    attachmentUploadProof: null,
    forkActionProof: null,
    responseCheckpoint: null,
    responseHash: null,
    chatTitleRename: null,
    updatedAt: now,
  };
  await atomicWrite(statePath(input.dataDir, input.executionId), next);
  return next;
};

const migrationIdentityRejection =
  "review_required: persisted web-chat execution identity does not match the requested feed.";

const isCleanTransientPreSubmission = (
  existing: WebChatExecutionRecord,
): boolean => {
  const isTerminalStateEcho = (
    failure: WebChatExecutionFailure,
  ): boolean =>
    /^review_required: web-chat execution is terminal:/iu.test(
      failure.reason,
    );
  const providerFailures = existing.failures.filter(
    (failure) =>
      failure.reason !== migrationIdentityRejection
      && !isTerminalStateEcho(failure),
  );
  return (
    existing.status === "failed"
    && !existing.submission
    && existing.uploadedFiles.length === 0
    && !existing.attachmentUploadProof
    && !existing.responseCheckpoint
    && !existing.responseHash
    && providerFailures.length > 0
    && providerFailures.every((failure) =>
      classifyWebChatFailure(
        new Error(failure.reason),
        false,
      ) === "recovery_pending")
    && existing.failures.every((failure) => (
      providerFailures.includes(failure)
      || failure.reason === migrationIdentityRejection
      || isTerminalStateEcho(failure)
    ))
  );
};

const restartForCorrectedLabel = async (
  input: StartWebChatExecutionInput,
  existing: WebChatExecutionRecord,
  cleanTransientPreSubmission: boolean,
): Promise<StartWebChatExecutionResult> => {
  const expectedLabel = resolveAiTaskLabel(input.taskLabelKey);
  const labelCorrectionOnly = (
    input.providerKind === "gpt-web-chat"
    && cleanTransientPreSubmission
    && Boolean(existing.systemChatTitle)
    && !existing.systemChatTitle?.startsWith(`${expectedLabel}｜`)
  );
  if (!labelCorrectionOnly) throw new Error(migrationIdentityRejection);
  return {
    record: await restartUnsubmittedExecution(input, existing),
    resume: false,
  };
};

const resumePersistedStatus = (
  existing: WebChatExecutionRecord,
): StartWebChatExecutionResult | null => {
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
  return null;
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
    || existing.submittedPromptHash !== expectedSubmittedPromptHash
  ) {
    throw new Error(migrationIdentityRejection);
  }
  const cleanTransientPreSubmission =
    isCleanTransientPreSubmission(existing);
  if (existing.inputHash !== input.inputHash) {
    return restartForCorrectedLabel(
      input,
      existing,
      cleanTransientPreSubmission,
    );
  }
  const persisted = resumePersistedStatus(existing);
  if (persisted) return persisted;
  if (cleanTransientPreSubmission) {
    return {
      record: await restartUnsubmittedExecution(input, existing),
      resume: false,
    };
  }
  const rootFailure = [...existing.failures]
    .reverse()
    .find((failure) =>
      failure.reason !== migrationIdentityRejection
      && !/^review_required: web-chat execution is terminal:/iu.test(
        failure.reason,
      ));
  throw new Error(
    `review_required: web-chat execution is terminal: ${existing.status}; root=${
      rootFailure?.reason ?? "unknown terminal provider failure"
    }`,
  );
};

const createWebChatExecution = async (
  input: StartWebChatExecutionInput,
): Promise<StartWebChatExecutionResult> => {
  const now = new Date().toISOString();
  const turnMarker = turnMarkerFor(input);
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
    providerLeaseId: null,
    submission: null,
    uploadedFiles: [],
    attachmentUploadProof: null,
    forkActionProof: null,
    responseCheckpoint: null,
    responseHash: null,
    chatTitleRename: null,
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
