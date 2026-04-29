import { createId } from "../../../lib/local-runtime/ids.js";
import type { StructuredLogBus } from "../../../lib/local-runtime/structured-log-bus.js";
import type { JsonStateStore } from "../../../lib/storage/json-state-store.js";
import { ImageEvidenceSchema, OcrTextResultSchema, type ImageEvidence, type OcrTextResult } from "../../../types/evidence.js";
import {
  BrowseLedgerEntrySchema,
  ProductDiscoveryEvidencePacketSchema,
  RoundLifecycleEventSchema,
  RoundStructuralLogSchema,
  type AdvancedAIExportSet,
  type BrowseLedgerEntry,
  type ProductDiscoveryEvidencePacket,
  type RoundLifecycleEvent,
  type RoundStructuralLog,
} from "../../../types/evidence-packet.js";
import { ActionLogSchema, type ActionLog } from "../../../types/platform-action.js";
import { ProductOpportunityCandidateSchema, type ProductOpportunityCandidate } from "../../../types/product-opportunity.js";
import { StoredAiResultSchema, type StoredAiResult } from "../../../types/stored-ai-result.js";
import { AgentRoundSchema, TaskRunSchema, type AgentRound, type RuntimeStatus, type TaskRun } from "../../../types/task-run.js";
import { StructuredActionLogSchema, StructuredRuntimeEventSchema, type StructuredActionLog, type StructuredRuntimeEvent } from "../../../types/structured-log.js";
import { buildAdvancedAiExportSet } from "./evidence-delivery-summary.js";
import { type ImageEvidenceInput, persistImageArtifact } from "./evidence-store-artifacts.js";
import type { PersistedState } from "./evidence-store-state.js";

type EvidenceStoreRecordsContext = {
  artifactsDir: string;
  stateStore: JsonStateStore<PersistedState>;
  structuredLogBus?: StructuredLogBus;
  init: () => Promise<void>;
  listState: () => Promise<PersistedState>;
};

function replaceOrAppend<TItem>(items: TItem[], nextItem: TItem, matches: (item: TItem) => boolean): void {
  const existingIndex = items.findIndex(matches);
  if (existingIndex >= 0) items[existingIndex] = nextItem;
  else items.push(nextItem);
}

export async function createTaskRunRecord(ctx: EvidenceStoreRecordsContext, platformId: string, maxRounds: number): Promise<TaskRun> {
  const state = await ctx.listState();
  const now = new Date().toISOString();
  const taskRun = TaskRunSchema.parse({ id: createId("task"), platformId, status: "running", createdAt: now, updatedAt: now, maxRounds, currentRoundIndex: 0 });
  state.taskRuns.push(taskRun);
  await ctx.stateStore.write(state);
  return taskRun;
}

export async function updateTaskRunRecord(ctx: EvidenceStoreRecordsContext, taskRunId: string, status: RuntimeStatus, note?: string): Promise<TaskRun> {
  const state = await ctx.listState();
  const taskRun = state.taskRuns.find((item) => item.id === taskRunId);
  if (!taskRun) throw new Error(`TaskRun not found: ${taskRunId}`);
  taskRun.status = status;
  taskRun.updatedAt = new Date().toISOString();
  if (note) taskRun.note = note;
  await ctx.stateStore.write(state);
  return TaskRunSchema.parse(taskRun);
}

export async function saveAgentRoundRecord(ctx: EvidenceStoreRecordsContext, round: AgentRound): Promise<AgentRound> {
  const state = await ctx.listState();
  const parsed = AgentRoundSchema.parse(round);
  replaceOrAppend(state.agentRounds, parsed, (item) => item.id === parsed.id);
  const taskRun = state.taskRuns.find((item) => item.id === parsed.taskRunId);
  if (taskRun) {
    taskRun.currentRoundIndex = parsed.index;
    taskRun.updatedAt = new Date().toISOString();
  }
  await ctx.stateStore.write(state);
  return parsed;
}

export async function hasSeenVideoVisitRecord(ctx: EvidenceStoreRecordsContext, taskRunId: string, videoVisitId: string): Promise<boolean> {
  const state = await ctx.listState();
  return state.agentRounds.some((item) => item.taskRunId === taskRunId && item.videoVisitId === videoVisitId);
}

export async function saveImageEvidenceRecord(ctx: EvidenceStoreRecordsContext, input: ImageEvidenceInput): Promise<ImageEvidence> {
  await ctx.init();
  const id = createId(input.kind === "video-screenshot" ? "video" : "comment");
  const createdAt = new Date().toISOString();
  const filePath = await persistImageArtifact({ artifactsDir: ctx.artifactsDir, evidenceId: id, title: input.summary, ...(input.contentLines ? { contentLines: input.contentLines } : {}), ...(input.sourceFilePath ? { sourceFilePath: input.sourceFilePath } : {}) });
  const record = ImageEvidenceSchema.parse({ id, taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.platformId, sourceId: input.sourceId, sourceUrl: input.sourceUrl, kind: input.kind, summary: input.summary, filePath, regionLabel: input.regionLabel, regionType: input.regionType, width: input.width, height: input.height, createdAt });
  const state = await ctx.listState();
  if (input.kind === "video-screenshot") state.videoEvidence.push(record);
  else state.commentEvidence.push(record);
  await ctx.stateStore.write(state);
  return record;
}

export async function saveOcrResultRecord(ctx: EvidenceStoreRecordsContext, input: OcrTextResult): Promise<OcrTextResult> {
  const state = await ctx.listState();
  const parsed = OcrTextResultSchema.parse(input);
  state.ocrResults.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveAiResultRecord(ctx: EvidenceStoreRecordsContext, input: unknown): Promise<StoredAiResult> {
  const state = await ctx.listState();
  const parsed = StoredAiResultSchema.parse(input);
  state.aiResults.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveActionLogRecord(ctx: EvidenceStoreRecordsContext, input: ActionLog): Promise<ActionLog> {
  const state = await ctx.listState();
  const parsed = ActionLogSchema.parse(input);
  state.actionLogs.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveStructuredRuntimeEventRecord(ctx: EvidenceStoreRecordsContext, input: StructuredRuntimeEvent): Promise<StructuredRuntimeEvent> {
  const state = await ctx.listState();
  const parsed = StructuredRuntimeEventSchema.parse(input);
  state.structuredRuntimeEvents.push(parsed);
  await ctx.stateStore.write(state);
  ctx.structuredLogBus?.emitRuntimeEvent(parsed);
  return parsed;
}

export async function saveStructuredActionLogRecord(ctx: EvidenceStoreRecordsContext, input: StructuredActionLog): Promise<StructuredActionLog> {
  const state = await ctx.listState();
  const parsed = StructuredActionLogSchema.parse(input);
  state.structuredActionLogs.push(parsed);
  await ctx.stateStore.write(state);
  ctx.structuredLogBus?.emitActionLog(parsed);
  return parsed;
}

export async function listStructuredRuntimeEventRecords(ctx: EvidenceStoreRecordsContext, tail = 200): Promise<StructuredRuntimeEvent[]> {
  const state = await ctx.listState();
  return state.structuredRuntimeEvents.slice(-Math.max(1, tail));
}

export async function listStructuredActionLogRecords(ctx: EvidenceStoreRecordsContext, tail = 200): Promise<StructuredActionLog[]> {
  const state = await ctx.listState();
  return state.structuredActionLogs.slice(-Math.max(1, tail));
}

export async function saveCandidateRecord(ctx: EvidenceStoreRecordsContext, input: ProductOpportunityCandidate): Promise<ProductOpportunityCandidate> {
  const state = await ctx.listState();
  const parsed = ProductOpportunityCandidateSchema.parse(input);
  replaceOrAppend(state.candidates, parsed, (item) => item.sourceVideoId === parsed.sourceVideoId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveEvidencePacketRecord(ctx: EvidenceStoreRecordsContext, input: ProductDiscoveryEvidencePacket): Promise<ProductDiscoveryEvidencePacket> {
  const state = await ctx.listState();
  const parsed = ProductDiscoveryEvidencePacketSchema.parse(input);
  replaceOrAppend(state.evidencePackets, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveBrowseLedgerEntryRecord(ctx: EvidenceStoreRecordsContext, input: BrowseLedgerEntry): Promise<BrowseLedgerEntry> {
  const state = await ctx.listState();
  const parsed = BrowseLedgerEntrySchema.parse(input);
  replaceOrAppend(state.browseLedgerEntries, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveRoundLifecycleEventRecord(ctx: EvidenceStoreRecordsContext, input: RoundLifecycleEvent): Promise<RoundLifecycleEvent> {
  const state = await ctx.listState();
  const parsed = RoundLifecycleEventSchema.parse(input);
  state.roundLifecycleEvents.push(parsed);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function saveRoundStructuralLogRecord(ctx: EvidenceStoreRecordsContext, input: RoundStructuralLog): Promise<RoundStructuralLog> {
  const state = await ctx.listState();
  const parsed = RoundStructuralLogSchema.parse(input);
  replaceOrAppend(state.roundStructuralLogs, parsed, (item) => item.roundId === parsed.roundId);
  await ctx.stateStore.write(state);
  return parsed;
}

export async function rebuildAdvancedAiExportSetRecord(ctx: EvidenceStoreRecordsContext, sessionId: string): Promise<AdvancedAIExportSet> {
  const state = await ctx.listState();
  const roundLogs = state.roundStructuralLogs.filter((item) => item.sessionId === sessionId);
  const roundIds = new Set(roundLogs.map((item) => item.roundId));
  const evidencePackets = state.evidencePackets.filter((item) => roundIds.has(item.roundId));
  const exportSet = buildAdvancedAiExportSet({ sessionId, roundLogs, evidencePackets });
  replaceOrAppend(state.advancedAiExports, exportSet, (item) => item.sessionId === sessionId);
  await ctx.stateStore.write(state);
  return exportSet;
}