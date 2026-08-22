import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiProviderUploadedFileProof,
  ProviderExecutionProfileProof,
  WebChatAttachmentUploadProof,
  WebChatConversationTitleState,
  WebChatForkActionProof,
  WebChatPageActionProof,
  WebChatSubmissionProof,
} from "../contracts/ai-provider-adapter.contract.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import type { AiFeedProviderExecutionProfile } from "../schema.js";
import type { WebChatResponseCheckpoint } from "./web-chat-response-checkpoint.js";

export type WebChatExecutionStatus =
  | "waiting_for_capacity"
  | "waiting_for_submit_slot"
  | "submitting"
  | "submitted_transient"
  | "conversation_canonicalized"
  | "waiting_provider"
  | "response_checkpointed"
  | "title_finalization_pending"
  | "title_verified"
  | "recovery_pending"
  | "response_captured"
  | "finalized"
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
  schemaVersion: "web-chat-execution-v3";
  executionId: string;
  attemptId: string;
  status: WebChatExecutionStatus;
  providerKind: "gpt-web-chat" | "gemini-web-chat";
  inputHash: string;
  turnMarker: string;
  submittedPromptHash: string;
  capacitySlot: number | null;
  providerLeaseId: string | null;
  providerExecutionProfileBinding: AiFeedProviderExecutionProfile | null;
  providerExecutionProfileProof: ProviderExecutionProfileProof | null;
  conversationTitle: WebChatConversationTitleState | null;
  pageActionLedger: WebChatPageActionProof[];
  submission: WebChatSubmissionProof | null;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof | null;
  forkActionProof: WebChatForkActionProof | null;
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

type LegacyWebChatExecutionV2 = Omit<
  WebChatExecutionRecord,
  | "schemaVersion"
  | "providerExecutionProfileBinding"
  | "providerExecutionProfileProof"
  | "conversationTitle"
  | "pageActionLedger"
> & {
  schemaVersion: "web-chat-execution-v2";
  systemChatTitle?: unknown;
  chatTitleRename?: unknown;
  submission?: (WebChatSubmissionProof & {
    systemChatTitle?: unknown;
    observedAutoChatTitle?: unknown;
    chatTitleVerifiedAt?: unknown;
  }) | null;
};

const migrateV2 = (legacy: LegacyWebChatExecutionV2): WebChatExecutionRecord => {
  const {
    systemChatTitle: _retiredTitle,
    chatTitleRename: _retiredRenameDebt,
    submission: rawSubmission,
    ...rest
  } = legacy;
  const submission = rawSubmission
    ? (({
        systemChatTitle: _retiredSubmissionTitle,
        observedAutoChatTitle: _retiredObservedTitle,
        chatTitleVerifiedAt: _retiredTitleVerification,
        ...proof
      }) => proof)(rawSubmission)
    : null;
  return {
    ...(rest as Omit<WebChatExecutionRecord, "schemaVersion" | "providerExecutionProfileBinding" | "providerExecutionProfileProof" | "conversationTitle" | "pageActionLedger" | "submission">),
    schemaVersion: "web-chat-execution-v3",
    providerExecutionProfileBinding: null,
    providerExecutionProfileProof: null,
    conversationTitle: null,
    pageActionLedger: [],
    submission,
  };
};

export const readWebChatExecution = async (
  dataDir: string,
  executionId: string,
): Promise<WebChatExecutionRecord | null> => {
  try {
    const parsed = JSON.parse(
      await readFile(statePath(dataDir, executionId), "utf8"),
    ) as WebChatExecutionRecord | LegacyWebChatExecutionV2;
    if (parsed.schemaVersion === "web-chat-execution-v3") return parsed;
    if (parsed.schemaVersion === "web-chat-execution-v2") {
      const migrated = migrateV2(parsed);
      await atomicWrite(statePath(dataDir, executionId), migrated);
      return migrated;
    }
    throw new Error(
      "review_required: unsupported web-chat execution state cannot enter the governed single-tab runtime.",
    );
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
  inputHash: string;
  textPrompt: string;
  providerExecutionProfileBinding?: AiFeedProviderExecutionProfile | null;
  conversationTitle?: WebChatConversationTitleState | null;
  createdAt?: string;
};

type StartWebChatExecutionResult = {
  record: WebChatExecutionRecord;
  resume: boolean;
};

const turnMarkerFor = (input: StartWebChatExecutionInput): string =>
  `GRASSEYE_TURN_${
    createHash("sha256")
      .update(input.turnIdentitySeed ?? `${input.executionId}\u0000${input.inputHash}`)
      .digest("hex")
      .slice(0, 32)
  }`;

const restartUnsubmittedExecution = async (
  input: StartWebChatExecutionInput,
  existing: WebChatExecutionRecord,
  correctionReason?: string,
): Promise<WebChatExecutionRecord> => {
  const now = new Date().toISOString();
  const turnMarker = turnMarkerFor(input);
  const next: WebChatExecutionRecord = {
    ...existing,
    attemptId: `web-chat-attempt:${randomUUID()}`,
    status: "recovery_pending",
    inputHash: input.inputHash,
    turnMarker,
    submittedPromptHash: hashSubmittedPrompt(input.textPrompt),
    capacitySlot: null,
    providerLeaseId: null,
    providerExecutionProfileBinding:
      input.providerExecutionProfileBinding ?? existing.providerExecutionProfileBinding,
    providerExecutionProfileProof: null,
    conversationTitle: input.conversationTitle ?? existing.conversationTitle,
    pageActionLedger: existing.pageActionLedger.slice(-40),
    submission: null,
    uploadedFiles: [],
    attachmentUploadProof: null,
    forkActionProof: null,
    responseCheckpoint: null,
    responseHash: null,
    failures: correctionReason ? [...existing.failures, {
      occurredAt: now,
      attemptId: existing.attemptId,
      phase: existing.status,
      classification: "recovery_pending",
      recoverable: true,
      reason: correctionReason,
    }] : existing.failures,
    updatedAt: now,
  };
  await atomicWrite(statePath(input.dataDir, input.executionId), next);
  return next;
};

const migrationIdentityRejection =
  "review_required: persisted web-chat execution identity does not match the requested feed.";
const TERMINAL_EXECUTION_ERROR_PREFIX =
  "review_required: web-chat execution is terminal:";
export const LEGACY_PROFILE_READBACK_STATE_CORRECTION =
  "LEGACY_PROFILE_READBACK_STATE_CORRECTION_APPLIED";
const legacyProfileReadbackReason =
  "review_required: NOT_PRODUCTION_VERIFIED: GPT pre-submit model and reasoning controls have no exact verified readback; GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH";
const missingSubmissionProofAfterLegacyCorrection =
  "review_required: submitted web-chat execution is missing its durable submission proof.";

const isCleanTransientPreSubmission = (
  existing: WebChatExecutionRecord,
): boolean => {
  const isTerminalStateEcho = (failure: WebChatExecutionFailure): boolean =>
    /^review_required: web-chat execution is terminal:/iu.test(failure.reason);
  const providerFailures = existing.failures.filter(
    (failure) => failure.reason !== migrationIdentityRejection && !isTerminalStateEcho(failure),
  );
  const rootlessTerminalAttempts = new Set(
    existing.failures.filter(isTerminalStateEcho).map((failure) => failure.attemptId),
  );
  const hasOneBoundedRootlessRecoveryAuthority =
    providerFailures.length === 0
    && existing.failures.length > 0
    && rootlessTerminalAttempts.size === 1;
  const isLegacyPreMutationTargetInvalid = (
    failure: WebChatExecutionFailure,
  ): boolean => failure.reason === "BROWSER_TARGET_INVALID"
    && failure.phase === "submitting"
    && existing.pageActionLedger.length === 0;
  return (
    existing.status === "failed"
    && !existing.submission
    && existing.uploadedFiles.length === 0
    && !existing.attachmentUploadProof
    && !existing.responseCheckpoint
    && !existing.responseHash
    && (providerFailures.length > 0 || hasOneBoundedRootlessRecoveryAuthority)
    && providerFailures.every((failure) =>
      classifyWebChatFailure(new Error(failure.reason), false) === "recovery_pending"
      || isLegacyPreMutationTargetInvalid(failure))
    && existing.failures.every((failure) => (
      providerFailures.includes(failure)
      || failure.reason === migrationIdentityRejection
      || isTerminalStateEcho(failure)
    ))
  );
};

const isProofEmptyLegacyProfileReadbackState = (
  existing: WebChatExecutionRecord,
): boolean => {
  const latestFailureReason = existing.failures.at(-1)?.reason;
  return (existing.status === "review_required" || existing.status === "failed")
  && !existing.submission
  && existing.uploadedFiles.length === 0
  && !existing.attachmentUploadProof
  && !existing.providerExecutionProfileProof
  && existing.pageActionLedger.length === 0
  && !existing.responseCheckpoint
  && !existing.responseHash
  && existing.failures.some((failure) => failure.reason === legacyProfileReadbackReason)
  && existing.failures.every((failure) =>
    failure.reason !== LEGACY_PROFILE_READBACK_STATE_CORRECTION)
  && (latestFailureReason === legacyProfileReadbackReason
    || latestFailureReason === missingSubmissionProofAfterLegacyCorrection);
};

const resumePersistedStatus = (
  existing: WebChatExecutionRecord,
): StartWebChatExecutionResult | null => {
  if ([
    "submitted_transient",
    "conversation_canonicalized",
    "waiting_provider",
    "response_checkpointed",
    "title_finalization_pending",
    "title_verified",
    "review_required",
  ].includes(existing.status)) {
    if (!existing.submission) {
      throw new Error(
        "review_required: submitted web-chat execution is missing its durable submission proof.",
      );
    }
    return { record: existing, resume: true };
  }
  if (existing.status === "recovery_pending") {
    return { record: existing, resume: Boolean(existing.submission) };
  }
  if (existing.status === "response_captured" || existing.status === "finalized") {
    throw new Error(
      "review_required: captured web-chat execution must be rehydrated from its persisted raw output.",
    );
  }
  if (existing.status !== "failed") return { record: existing, resume: false };
  return null;
};

const resumeExistingWebChatExecution = async (
  input: StartWebChatExecutionInput,
  existing: WebChatExecutionRecord,
): Promise<StartWebChatExecutionResult> => {
  const expectedSubmittedPromptHash = hashSubmittedPrompt(input.textPrompt);
  if (
    existing.providerKind !== input.providerKind
    || existing.submittedPromptHash !== expectedSubmittedPromptHash
  ) throw new Error(migrationIdentityRejection);
  const cleanTransientPreSubmission = isCleanTransientPreSubmission(existing);
  const proofEmptyLegacyProfileReadback =
    isProofEmptyLegacyProfileReadbackState(existing);
  if (existing.inputHash !== input.inputHash) {
    if (!cleanTransientPreSubmission) throw new Error(migrationIdentityRejection);
    return { record: await restartUnsubmittedExecution(input, existing), resume: false };
  }
  if (input.providerExecutionProfileBinding
    && existing.providerExecutionProfileBinding
    && input.providerExecutionProfileBinding.profileHash
      !== existing.providerExecutionProfileBinding.profileHash) {
    throw new Error(migrationIdentityRejection);
  }
  if (proofEmptyLegacyProfileReadback) {
    return {
      record: await restartUnsubmittedExecution(
        input,
        existing,
        LEGACY_PROFILE_READBACK_STATE_CORRECTION,
      ),
      resume: false,
    };
  }
  const persisted = resumePersistedStatus(existing);
  if (persisted) return persisted;
  if (cleanTransientPreSubmission) {
    return { record: await restartUnsubmittedExecution(input, existing), resume: false };
  }
  const rootFailure = [...existing.failures].reverse().find((failure) =>
    failure.reason !== migrationIdentityRejection
    && !/^review_required: web-chat execution is terminal:/iu.test(failure.reason));
  throw new Error(
    `${TERMINAL_EXECUTION_ERROR_PREFIX} ${existing.status}; root=${
      rootFailure?.reason ?? "unknown terminal provider failure"
    }`,
  );
};

const createWebChatExecution = async (
  input: StartWebChatExecutionInput,
): Promise<StartWebChatExecutionResult> => {
  const now = input.createdAt ?? new Date().toISOString();
  const record: WebChatExecutionRecord = {
    schemaVersion: "web-chat-execution-v3",
    executionId: input.executionId,
    attemptId: `web-chat-attempt:${randomUUID()}`,
    status: "waiting_for_capacity",
    providerKind: input.providerKind,
    inputHash: input.inputHash,
    turnMarker: turnMarkerFor(input),
    submittedPromptHash: hashSubmittedPrompt(input.textPrompt),
    capacitySlot: null,
    providerLeaseId: null,
    providerExecutionProfileBinding: input.providerExecutionProfileBinding ?? null,
    providerExecutionProfileProof: null,
    conversationTitle: input.conversationTitle ?? null,
    pageActionLedger: [],
    submission: null,
    uploadedFiles: [],
    attachmentUploadProof: null,
    forkActionProof: null,
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
    ? resumeExistingWebChatExecution(input, existing)
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

export const hashSubmittedPrompt = (textPrompt: string): string =>
  `sha256:${createHash("sha256").update(textPrompt).digest("hex")}`;
