import { randomUUID } from "node:crypto";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
  AiInputGatewayProgress,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  XUANYUAN_JOB_ID,
  XuanyuanRequestSchema,
  type XuanyuanRequest,
  type XuanyuanTaskRecord,
  type XuanyuanTaskStatus,
} from "./xuanyuan.schema.js";
import {
  listStoredXuanyuanTasks,
  readXuanyuanTask,
  writeXuanyuanTask,
} from "./xuanyuan.store.js";
import {
  buildXuanyuanTaskName,
  resolveXuanyuanTaskLabelKey,
} from "./xuanyuan-task-identity.js";

export type XuanyuanRuntime = {
  aiInputGateway: AiInputGatewayAbilityGroup;
  dataDir: string;
};

type XuanyuanContinuation = NonNullable<AiFeedInput["providerContinuationRef"]>;

const nowIso = (): string => new Date().toISOString();

const buildTextPrompt = (request: XuanyuanRequest): string => {
  if (request.textPrompt) return request.textPrompt;
  return [
    request.systemPrompt ? `# system\n${request.systemPrompt}` : null,
    request.userPrompt ? `# user\n${request.userPrompt}` : null,
    request.payloadJson === undefined
      ? null
      : `# payloadJson\n${JSON.stringify(request.payloadJson, null, 2)}`,
  ].filter((part): part is string => Boolean(part)).join("\n\n").trim();
};

const resolveContinuation = async (
  dataDir: string,
  request: XuanyuanRequest,
): Promise<XuanyuanContinuation | undefined> => {
  if (!request.continuationTaskId || !request.continuationResponseHash) return undefined;
  const prior = await readXuanyuanTask(dataDir, request.continuationTaskId);
  if (!prior) throw new Error("XUANYUAN_CONTINUATION_TASK_NOT_FOUND");
  if (prior.sourceProject !== request.sourceProject) throw new Error("XUANYUAN_CONTINUATION_SOURCE_PROJECT_MISMATCH");
  if (prior.providerKind !== request.providerKind) throw new Error("XUANYUAN_CONTINUATION_PROVIDER_MISMATCH");
  if (prior.status !== "response_captured") throw new Error("XUANYUAN_CONTINUATION_PRIOR_RESPONSE_NOT_CAPTURED");
  if (!prior.rawOutputHash || prior.rawOutputHash !== request.continuationResponseHash) {
    throw new Error("XUANYUAN_CONTINUATION_RESPONSE_HASH_MISMATCH");
  }
  const providerPageUrl = prior.providerProof?.webChatUrl;
  if (!providerPageUrl) throw new Error("XUANYUAN_CONTINUATION_PROVIDER_URL_MISSING");
  const parsed = new URL(providerPageUrl);
  if (parsed.protocol !== "https:" || parsed.host !== "chatgpt.com" || !parsed.pathname.includes("/c/")) {
    throw new Error("XUANYUAN_CONTINUATION_PROVIDER_URL_INVALID");
  }
  return {
    priorTaskId: prior.taskId,
    priorRawOutputHash: prior.rawOutputHash,
    providerPageUrl,
  };
};

const toAiFeedInput = (
  record: XuanyuanTaskRecord,
  request: XuanyuanRequest,
  continuation?: XuanyuanContinuation,
): AiFeedInput => ({
  providerKind: request.providerKind,
  taskIdentity: {
    labelKey: record.taskLabelKey,
    sourceProject: request.sourceProject,
    taskKind: request.scenario,
    sourceTaskId: record.taskId,
  },
  promptPackageId: request.promptPackageId,
  promptContractId: request.promptContractId,
  expectedOutputSchemaRef: request.expectedOutputSchemaRef,
  textPrompt: buildTextPrompt(request),
  inputRefs: request.inputRefs,
  timeoutMs: request.timeoutMs,
  maxInputChars: request.maxInputChars,
  maxFileCount: request.maxFileCount,
  maxFileBytes: request.maxFileBytes,
  requestedBy: "ai-capability",
  missionId: XUANYUAN_JOB_ID,
  runId: request.requestId,
  roundId: `${XUANYUAN_JOB_ID}:${request.requestId}`,
  modelName: null,
  ...(continuation ? { providerContinuationRef: continuation } : {}),
});

const statusFromResult = (
  result: AiFeedResult,
  phase: XuanyuanTaskRecord["progress"]["phase"],
): XuanyuanTaskStatus => {
  if (
    phase === "recovery_pending"
    && (result.status === "failed" || result.status === "review_required")
  ) {
    return "recovery_pending";
  }
  if (result.status === "review_required") return "review_required";
  if (result.status === "failed") return "failed";
  return "response_captured";
};

const updateProgress = async (
  runtime: XuanyuanRuntime,
  taskId: string,
  progress: AiInputGatewayProgress,
): Promise<void> => {
  const current = await readXuanyuanTask(runtime.dataDir, taskId);
  if (!current || current.status === "response_captured") return;
  await writeXuanyuanTask(runtime.dataDir, {
    ...current,
    status: progress.phase === "recovery_pending" ? "recovery_pending" : "running",
    progress: {
      ...current.progress,
      phase: progress.phase,
      lastTransitionAt: progress.occurredAt,
    },
    recovery: {
      ...current.recovery,
      recoverable: progress.phase === "recovery_pending",
      recoveryDirective: progress.phase === "recovery_pending"
        ? "resume_exact_provider_conversation"
        : current.recovery.recoveryDirective,
    },
    updatedAt: progress.occurredAt,
  });
};

const updateAttachmentProof = async (
  runtime: XuanyuanRuntime,
  taskId: string,
  proof: WebChatAttachmentUploadProof,
): Promise<void> => {
  const current = await readXuanyuanTask(runtime.dataDir, taskId);
  if (!current || current.status === "response_captured") return;
  await writeXuanyuanTask(runtime.dataDir, {
    ...current,
    progress: { ...current.progress, attachmentUploadProof: proof },
    updatedAt: nowIso(),
  });
};

const finishWithResult = (
  record: XuanyuanTaskRecord,
  result: AiFeedResult,
): XuanyuanTaskRecord => {
  const status = statusFromResult(result, record.progress.phase);
  const now = nowIso();
  return {
    ...record,
    status,
    aiFeedResult: result,
    rawResponseText: result.rawResponseText ?? null,
    rawOutputRef: result.rawOutputRef,
    rawOutputHash: result.rawOutputHash,
    transportWarnings: result.transportWarnings ?? [],
    providerProof: result.providerProof,
    progress: {
      ...record.progress,
      phase: status === "recovery_pending" ? "recovery_pending" : "terminal",
      lastTransitionAt: now,
      attachmentUploadProof:
        (result.providerProof.attachmentUploadProof as WebChatAttachmentUploadProof | undefined)
        ?? record.progress.attachmentUploadProof,
    },
    recovery: {
      ...record.recovery,
      recoverable: status === "recovery_pending",
      lastFailureAt: status === "recovery_pending" ? now : null,
      lastFailureReason: result.failureReason ?? result.reviewRequiredReason,
      recoveryDirective: status === "recovery_pending"
        ? "resume_exact_provider_conversation"
        : "none",
    },
    conversationProof: record.continuationTaskId ? {
      priorTaskId: record.continuationTaskId,
      priorRawOutputHash: record.requestSnapshot.continuationResponseHash!,
      requestedProviderPageUrl: result.providerProof.continuationRequestedUrl ?? "",
      actualProviderPageUrl:
        result.providerProof.continuationActualUrl ?? result.providerProof.webChatUrl,
      verified: result.providerProof.continuationVerified === true,
    } : null,
    failureReason: result.failureReason,
    reviewRequiredReason: result.reviewRequiredReason,
    updatedAt: now,
  };
};

const finishWithThrownFailure = (
  record: XuanyuanTaskRecord,
  error: unknown,
): XuanyuanTaskRecord => {
  const reason = error instanceof Error ? error.message : String(error);
  const recoverable = [
    "waiting_provider",
    "response_checkpointed",
    "recovery_pending",
  ].includes(record.progress.phase);
  const now = nowIso();
  return {
    ...record,
    status: recoverable ? "recovery_pending" : "failed",
    failureReason: reason,
    reviewRequiredReason: null,
    progress: {
      ...record.progress,
      phase: recoverable ? "recovery_pending" : "terminal",
      lastTransitionAt: now,
    },
    recovery: {
      ...record.recovery,
      recoverable,
      lastFailureAt: now,
      lastFailureReason: reason,
      recoveryDirective: recoverable ? "resume_exact_provider_conversation" : "none",
    },
    updatedAt: now,
  };
};

export const createXuanyuanTask = async (
  runtime: XuanyuanRuntime,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  const request = XuanyuanRequestSchema.parse(rawRequest);
  const textPrompt = buildTextPrompt(request);
  if (!textPrompt) throw new Error("xuanyuan_text_prompt_required");
  const canonicalRequest = { ...request, textPrompt };
  const existing = (await listStoredXuanyuanTasks(runtime.dataDir)).find(
    (task) =>
      task.sourceProject === request.sourceProject
      && task.requestId === request.requestId,
  );
  if (existing) {
    if (JSON.stringify(existing.requestSnapshot) !== JSON.stringify(canonicalRequest)) {
      throw new Error("XUANYUAN_REQUEST_IDENTITY_CONFLICT");
    }
    return existing;
  }
  await resolveContinuation(runtime.dataDir, canonicalRequest);
  const taskId = `${XUANYUAN_JOB_ID}_${randomUUID()}`;
  const createdAt = nowIso();
  const taskLabelKey = resolveXuanyuanTaskLabelKey(request.scenario);
  return writeXuanyuanTask(runtime.dataDir, {
    taskId,
    taskName: buildXuanyuanTaskName(taskLabelKey, taskId),
    taskLabelKey,
    jobId: XUANYUAN_JOB_ID,
    requestId: request.requestId,
    sourceProject: request.sourceProject,
    scenario: request.scenario,
    providerKind: request.providerKind,
    status: "queued",
    requestSnapshot: canonicalRequest,
    promptPackageSnapshot: {
      promptPackageId: request.promptPackageId,
      promptContractId: request.promptContractId,
      expectedOutputSchemaRef: request.expectedOutputSchemaRef,
      textPrompt,
      inputRefs: request.inputRefs,
    },
    aiFeedResult: null,
    rawResponseText: null,
    rawOutputRef: null,
    rawOutputHash: null,
    transportWarnings: [],
    providerProof: null,
    progress: {
      executionId: taskId,
      phase: "queued",
      lastTransitionAt: createdAt,
      attachmentUploadProof: null,
    },
    recovery: {
      attemptCount: 0,
      recoverable: false,
      lastAttemptStartedAt: null,
      lastFailureAt: null,
      lastFailureReason: null,
      recoveryDirective: "none",
    },
    continuationTaskId: request.continuationTaskId ?? null,
    conversationProof: null,
    failureReason: null,
    reviewRequiredReason: null,
    createdAt,
    updatedAt: createdAt,
  });
};

export const executeXuanyuanTask = async (
  runtime: XuanyuanRuntime,
  taskId: string,
): Promise<XuanyuanTaskRecord> => {
  const existing = await readXuanyuanTask(runtime.dataDir, taskId);
  if (!existing) throw new Error("XUANYUAN_TASK_NOT_FOUND");
  if (existing.status === "response_captured") return existing;
  const request = XuanyuanRequestSchema.parse(existing.requestSnapshot);
  const continuation = await resolveContinuation(runtime.dataDir, request);
  const startedAt = nowIso();
  const running = await writeXuanyuanTask(runtime.dataDir, {
    ...existing,
    status: "running",
    progress: {
      ...existing.progress,
      phase: "running",
      lastTransitionAt: startedAt,
    },
    recovery: {
      ...existing.recovery,
      attemptCount: existing.recovery.attemptCount + 1,
      lastAttemptStartedAt: startedAt,
    },
    failureReason: null,
    reviewRequiredReason: null,
    updatedAt: startedAt,
  });
  try {
    const result = await runtime.aiInputGateway.execute(
      toAiFeedInput(running, request, continuation),
      {
        executionId: taskId,
        onAttachmentUploadCompleted: (proof) =>
          updateAttachmentProof(runtime, taskId, proof),
        onProgress: (progress) => updateProgress(runtime, taskId, progress),
      },
    );
    const current = await readXuanyuanTask(runtime.dataDir, taskId) ?? running;
    return writeXuanyuanTask(runtime.dataDir, finishWithResult(current, result));
  } catch (error) {
    const current = await readXuanyuanTask(runtime.dataDir, taskId) ?? running;
    return writeXuanyuanTask(runtime.dataDir, finishWithThrownFailure(current, error));
  }
};

export const recordXuanyuanCoordinatorFailure = async (
  runtime: Pick<XuanyuanRuntime, "dataDir">,
  taskId: string,
  error: unknown,
): Promise<void> => {
  const current = await readXuanyuanTask(runtime.dataDir, taskId);
  if (!current || current.status === "response_captured") return;
  await writeXuanyuanTask(
    runtime.dataDir,
    finishWithThrownFailure(current, error),
  );
};
