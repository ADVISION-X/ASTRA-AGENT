import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
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

const toAiFeedInput = (request: XuanyuanRequest): AiFeedInput => ({
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
});

const statusFromAiFeedResult = (result: AiFeedResult): XuanyuanTaskStatus => {
  if (result.status === "review_required") return "review_required";
  if (result.status === "failed" && result.rawOutputRef) return "parse_failed_raw_available";
  if (result.status === "failed") return "failed";
  return "succeeded";
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
    normalizedText: null,
    rawOutputRef: null,
    rawOutputHash: null,
    parseStatus: null,
    schemaValidationStatus: null,
    parsedJson: null,
    providerProof: null,
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
  normalizedText: result.normalizedText,
  rawOutputRef: result.rawOutputRef,
  rawOutputHash: result.rawOutputHash,
  parseStatus: result.parseStatus,
  schemaValidationStatus: result.schemaValidationStatus,
  parsedJson: result.parsedJson,
  providerProof: result.providerProof,
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

export const startXuanyuanTask = async (
  runtime: XuanyuanRuntime,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  const request = XuanyuanRequestSchema.parse(rawRequest);
  const textPrompt = buildTextPrompt(request);
  if (!textPrompt) throw new Error("xuanyuan_text_prompt_required");
  const taskId = `${XUANYUAN_JOB_ID}_${randomUUID()}`;
  const initial = await writeTask(runtime.dataDir, buildInitialRecord({ request, taskId, textPrompt }));
  const running = await writeTask(runtime.dataDir, { ...initial, status: "running", updatedAt: nowIso() });
  const aiFeedResult = await runtime.aiInputGateway.execute(toAiFeedInput({
    ...request,
    textPrompt,
  }));
  return writeTask(runtime.dataDir, withAiFeedResult({
    ...running,
    status: "provider_answer_captured",
    updatedAt: nowIso(),
  }, aiFeedResult));
};

export const startXuanyuanTaskAsync = async (
  runtime: XuanyuanRuntime,
  rawRequest: unknown,
): Promise<XuanyuanTaskRecord> => {
  const request = XuanyuanRequestSchema.parse(rawRequest);
  const textPrompt = buildTextPrompt(request);
  if (!textPrompt) throw new Error("xuanyuan_text_prompt_required");
  const taskId = `${XUANYUAN_JOB_ID}_${randomUUID()}`;
  const initial = await writeTask(runtime.dataDir, buildInitialRecord({ request, taskId, textPrompt }));
  const running = await writeTask(runtime.dataDir, { ...initial, status: "running", updatedAt: nowIso() });
  void runtime.aiInputGateway.execute(toAiFeedInput({
    ...request,
    textPrompt,
  })).then((aiFeedResult) =>
    writeTask(runtime.dataDir, withAiFeedResult({
      ...running,
      status: "provider_answer_captured",
      updatedAt: nowIso(),
    }, aiFeedResult)),
  ).catch((error) =>
    writeTask(runtime.dataDir, withFailure(running, error)).then(() => undefined),
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
