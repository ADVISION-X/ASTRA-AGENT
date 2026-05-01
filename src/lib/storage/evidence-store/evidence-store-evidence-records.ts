import {
  ActionLogSchema,
  ImageEvidenceSchema,
  OcrTextResultSchema,
  StoredAiResultSchema,
  StructuredActionLogSchema,
  StructuredRuntimeEventSchema,
  type ActionLog,
  type ImageEvidence,
  type OcrTextResult,
  type StoredAiResult,
  type StructuredActionLog,
  type StructuredRuntimeEvent,
} from "./evidence-store-models.js";
import { createEvidenceStoreId } from "./evidence-store-runtime-types.js";
import { persistImageArtifact, type ImageEvidenceInput } from "./evidence-store-artifacts.js";
import type { EvidenceStoreRecordsContext } from "./evidence-store-record-context.js";

export async function saveImageEvidenceRecord(
  ctx: EvidenceStoreRecordsContext,
  input: ImageEvidenceInput,
): Promise<ImageEvidence> {
  await ctx.init();
  const id = createEvidenceStoreId(input.kind === "video-screenshot" ? "video" : "comment");
  const createdAt = new Date().toISOString();
  const filePath = await persistImageArtifact({
    artifactsDir: ctx.artifactsDir,
    evidenceId: id,
    title: input.summary,
    ...(input.contentLines ? { contentLines: input.contentLines } : {}),
    ...(input.sourceFilePath ? { sourceFilePath: input.sourceFilePath } : {}),
  });
  const record = ImageEvidenceSchema.parse({
    id,
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    platformId: input.platformId,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    kind: input.kind,
    summary: input.summary,
    filePath,
    regionLabel: input.regionLabel,
    regionType: input.regionType,
    width: input.width,
    height: input.height,
    createdAt,
  });
  const state = await ctx.listState();
  if (input.kind === "video-screenshot") {
    state.videoEvidence.push(record);
  } else {
    state.commentEvidence.push(record);
  }
  await ctx.stateStore.write(state);
  return record;
}

export async function saveOcrResultRecord(
  ctx: EvidenceStoreRecordsContext,
  input: OcrTextResult,
): Promise<OcrTextResult> {
  const state = await ctx.listState();
  const parsed = OcrTextResultSchema.parse(input);
  state.ocrResults.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveAiResultRecord(
  ctx: EvidenceStoreRecordsContext,
  input: unknown,
): Promise<StoredAiResult> {
  const state = await ctx.listState();
  const parsed = StoredAiResultSchema.parse(input);
  state.aiResults.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveActionLogRecord(
  ctx: EvidenceStoreRecordsContext,
  input: ActionLog,
): Promise<ActionLog> {
  const state = await ctx.listState();
  const parsed = ActionLogSchema.parse(input);
  state.actionLogs.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveStructuredRuntimeEventRecord(
  ctx: EvidenceStoreRecordsContext,
  input: StructuredRuntimeEvent,
): Promise<StructuredRuntimeEvent> {
  const state = await ctx.listState();
  const parsed = StructuredRuntimeEventSchema.parse(input);
  state.structuredRuntimeEvents.push(parsed);
  await ctx.stateStore.write(state);
  ctx.structuredLogBus?.emitRuntimeEvent(parsed);
  return parsed;
}

export async function saveStructuredActionLogRecord(
  ctx: EvidenceStoreRecordsContext,
  input: StructuredActionLog,
): Promise<StructuredActionLog> {
  const state = await ctx.listState();
  const parsed = StructuredActionLogSchema.parse(input);
  state.structuredActionLogs.push(parsed);
  await ctx.stateStore.write(state);
  ctx.structuredLogBus?.emitActionLog(parsed);
  return parsed;
}

export async function listStructuredRuntimeEventRecords(
  ctx: EvidenceStoreRecordsContext,
  tail = 200,
): Promise<StructuredRuntimeEvent[]> {
  const state = await ctx.listState();
  return state.structuredRuntimeEvents.slice(-Math.max(1, tail));
}

export async function listStructuredActionLogRecords(
  ctx: EvidenceStoreRecordsContext,
  tail = 200,
): Promise<StructuredActionLog[]> {
  const state = await ctx.listState();
  return state.structuredActionLogs.slice(-Math.max(1, tail));
}