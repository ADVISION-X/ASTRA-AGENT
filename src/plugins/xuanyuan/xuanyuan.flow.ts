import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
  WebChatAttachmentUploadProof,
} from "../../capabilities/ai-input-gateway/index.js";
import {
  XUANYUAN_JOB_ID,
  XuanyuanRequestSchema,
  type XuanyuanRequest,
  type XuanyuanTaskRecord,
  type XuanyuanTaskStatus,
} from "./xuanyuan.schema.js";

type XuanyuanRuntime = {
  aiInputGateway: AiInputGatewayAbilityGroup;
  dataDir: string;
};

const tasksDir = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", XUANYUAN_JOB_ID, "tasks");

const taskPath = (dataDir: string, taskId: string): string =>
  path.join(tasksDir(dataDir), `${taskId}.json`);

const nowIso = (): string => new Date().toISOString();

const buildTextPrompt = (request: XuanyuanRequest): string => {
  if (request.textPrompt) return request.textPrompt;
  return [
    request.systemPrompt ? `# system\n${request.systemPrompt}` : null,
    request.userPrompt ? `# user\n${request.userPrompt}` : null,
    request.payloadJson === undefined ? null : `# payloadJson\n${JSON.stringify(request.payloadJson, null, 2)}`,
  ].filter((part): part is string => Boolean(part)).join("\n\n").trim();
};

type XuanyuanContinuation = NonNullable<AiFeedInput["providerContinuationRef"]>;

const toAiFeedInput = (request: XuanyuanRequest, continuation?: XuanyuanContinuation): AiFeedInput => ({
  providerKind: request.providerKind,
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

const statusFromAiFeedResult = (result: AiFeedResult): XuanyuanTaskStatus => {
  if (result.status === "review_required") return "review_required";
  if (result.status === "failed") return "failed";
  return "response_captured";
};

const buildInitialRecord = (input: {
  request: XuanyuanRequest;
  taskId: string;
  textPrompt: string;
}): XuanyuanTaskRecord => {
  const createdAt = nowIso();
  return {
    taskId: input.taskId,
    jobId: XUANYUAN_JOB_ID,
    requestId: input.request.requestId,
    sourceProject: input.request.sourceProject,
    scenario: input.request.scenario,
    providerKind: input.request.providerKind,
    status: "accepted",
    requestSnapshot: input.request,
    promptPackageSnapshot: {
      promptPackageId: input.request.promptPackageId,
      promptContractId: input.request.promptContractId,
      expectedOutputSchemaRef: input.request.expectedOutputSchemaRef,
      textPrompt: input.textPrompt,
      inputRefs: input.request.inputRefs,
    },
    aiFeedResult: null,
    rawResponseText: null,
    rawOutputRef: null,
    rawOutputHash: null,
    transportWarnings: [],
    providerProof: null,
    progress: {
      attachmentUploadProof: null,
    },
    continuationTaskId: input.request.continuationTaskId ?? null,
    conversationProof: null,
    failureReason: null,
    reviewRequiredReason: null,
    createdAt,
    updatedAt: createdAt,
  };
};

const withAiFeedResult = (
  record: XuanyuanTaskRecord,
  result: AiFeedResult,
): XuanyuanTaskRecord => ({
  ...record,
  status: statusFromAiFeedResult(result),
  aiFeedResult: result,
  rawResponseText: result.rawResponseText ?? null,
  rawOutputRef: result.rawOutputRef,
  rawOutputHash: result.rawOutputHash,
  transportWarnings: result.transportWarnings ?? [],
  providerProof: result.providerProof,
  progress: {
    attachmentUploadProof: (result.providerProof.attachmentUploadProof as WebChatAttachmentUploadProof | undefined)
      ?? record.progress.attachmentUploadProof,
  },
  conversationProof: record.continuationTaskId ? {
    priorTaskId: record.continuationTaskId,
    priorRawOutputHash: record.requestSnapshot.continuationResponseHash!,
    requestedProviderPageUrl: result.providerProof.continuationRequestedUrl ?? "",
    actualProviderPageUrl: result.providerProof.continuationActualUrl ?? result.providerProof.webChatUrl,
    verified: result.providerProof.continuationVerified === true,
  } : null,
  failureReason: result.failureReason,
  reviewRequiredReason: result.reviewRequiredReason,
  updatedAt: nowIso(),
});

const withFailure = (
  record: XuanyuanTaskRecord,
  error: unknown,
): XuanyuanTaskRecord => ({
  ...record,
  status: "failed",
  failureReason: error instanceof Error ? error.message : String(error),
  reviewRequiredReason: null,
  updatedAt: nowIso(),
});

const writeTask = async (dataDir: string, record: XuanyuanTaskRecord): Promise<XuanyuanTaskRecord> => {
  await mkdir(tasksDir(dataDir), { recursive: true });
  await writeFile(taskPath(dataDir, record.taskId), JSON.stringify(record, null, 2), "utf8");
  return record;
};

const recordAttachmentUpload = async (
  dataDir: string,
  taskId: string,
  proof: WebChatAttachmentUploadProof,
): Promise<void> => {
  const current = await readTask(dataDir, taskId);
  if (!current || current.status !== "running") return;
  await writeTask(dataDir, {
    ...current,
    progress: { attachmentUploadProof: proof },
    updatedAt: nowIso(),
  });
};

const readTask = async (dataDir: string, taskId: string): Promise<XuanyuanTaskRecord | null> => {
  try {
    return JSON.parse(await readFile(taskPath(dataDir, taskId), "utf8")) as XuanyuanTaskRecord;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const resolveContinuation = async (dataDir: string, request: XuanyuanRequest): Promise<XuanyuanContinuation | undefined> => {
  if (!request.continuationTaskId || !request.continuationResponseHash) return undefined;
  const prior = await readTask(dataDir, request.continuationTaskId);
  if (!prior) throw new Error("XUANYUAN_CONTINUATION_TASK_NOT_FOUND");
  if (prior.sourceProject !== request.sourceProject) throw new Error("XUANYUAN_CONTINUATION_SOURCE_PROJECT_MISMATCH");
  if (prior.providerKind !== request.providerKind) throw new Error("XUANYUAN_CONTINUATION_PROVIDER_MISMATCH");
  if (prior.status !== "response_captured") throw new Error("XUANYUAN_CONTINUATION_PRIOR_RESPONSE_NOT_CAPTURED");
  if (!prior.rawOutputHash || prior.rawOutputHash !== request.continuationResponseHash) throw new Error("XUANYUAN_CONTINUATION_RESPONSE_HASH_MISMATCH");
  const providerPageUrl = prior.providerProof?.webChatUrl;
  if (!providerPageUrl) throw new Error("XUANYUAN_CONTINUATION_PROVIDER_URL_MISSING");
  const parsed = new URL(providerPageUrl);
  if (parsed.protocol !== "https:" || parsed.host !== "chatgpt.com" || !parsed.pathname.includes("/c/")) {
    throw new Error("XUANYUAN_CONTINUATION_PROVIDER_URL_INVALID");
  }
  return { priorTaskId: prior.taskId, priorRawOutputHash: prior.rawOutputHash, providerPageUrl };
};

export const startXuanyuanTask = async (
  runtime: XuanyuanRuntime,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  const request = XuanyuanRequestSchema.parse(rawRequest);
  const textPrompt = buildTextPrompt(request);
  if (!textPrompt) throw new Error("xuanyuan_text_prompt_required");
  const continuation = await resolveContinuation(runtime.dataDir, request);
  const taskId = `${XUANYUAN_JOB_ID}_${randomUUID()}`;
  const initial = await writeTask(runtime.dataDir, buildInitialRecord({ request, taskId, textPrompt }));
  const running = await writeTask(runtime.dataDir, { ...initial, status: "running", updatedAt: nowIso() });
  const aiFeedResult = await runtime.aiInputGateway.execute(toAiFeedInput({
    ...request,
    textPrompt,
  }, continuation), {
    onAttachmentUploadCompleted: (proof) => recordAttachmentUpload(runtime.dataDir, taskId, proof),
  });
  return writeTask(
    runtime.dataDir,
    withAiFeedResult(await readTask(runtime.dataDir, taskId) ?? running, aiFeedResult),
  );
};

export const startXuanyuanTaskAsync = async (
  runtime: XuanyuanRuntime,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  const request = XuanyuanRequestSchema.parse(rawRequest);
  const textPrompt = buildTextPrompt(request);
  if (!textPrompt) throw new Error("xuanyuan_text_prompt_required");
  const continuation = await resolveContinuation(runtime.dataDir, request);
  const taskId = `${XUANYUAN_JOB_ID}_${randomUUID()}`;
  const initial = await writeTask(runtime.dataDir, buildInitialRecord({ request, taskId, textPrompt }));
  const running = await writeTask(runtime.dataDir, { ...initial, status: "running", updatedAt: nowIso() });
  void runtime.aiInputGateway.execute(toAiFeedInput({
    ...request,
    textPrompt,
  }, continuation), {
    onAttachmentUploadCompleted: (proof) => recordAttachmentUpload(runtime.dataDir, taskId, proof),
  }).then(async (aiFeedResult) =>
    writeTask(
      runtime.dataDir,
      withAiFeedResult(await readTask(runtime.dataDir, taskId) ?? running, aiFeedResult),
    ),
  ).catch(async (error) =>
    writeTask(
      runtime.dataDir,
      withFailure(await readTask(runtime.dataDir, taskId) ?? running, error),
    ).then(() => undefined),
  );
  return running;
};

export const getXuanyuanTaskStatus = (
  runtime: Pick<XuanyuanRuntime, "dataDir">,
  taskId: string,
): Promise<XuanyuanTaskRecord | null> => readTask(runtime.dataDir, taskId);

export const listXuanyuanHistory = async (
  runtime: Pick<XuanyuanRuntime, "dataDir">,
): Promise<XuanyuanTaskRecord[]> => {
  try {
    const names = await readdir(tasksDir(runtime.dataDir));
    const records = await Promise.all(
      names.filter((name) => name.endsWith(".json")).map((name) =>
        readTask(runtime.dataDir, name.slice(0, -".json".length))),
    );
    return records
      .filter((record): record is XuanyuanTaskRecord => Boolean(record))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const getLatestXuanyuanTask = async (
  runtime: Pick<XuanyuanRuntime, "dataDir">,
): Promise<XuanyuanTaskRecord | null> => (await listXuanyuanHistory(runtime))[0] ?? null;
