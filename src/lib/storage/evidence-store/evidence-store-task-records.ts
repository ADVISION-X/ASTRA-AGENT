import {
  AgentRoundSchema,
  TaskRunSchema,
  type AgentRound,
  type RuntimeStatus,
  type TaskRun,
} from "./evidence-store-models.js";
import { createEvidenceStoreId } from "./evidence-store-runtime-types.js";
import { replaceOrAppend, type EvidenceStoreRecordsContext } from "./evidence-store-record-context.js";

export async function createTaskRunRecord(
  ctx: EvidenceStoreRecordsContext,
  platformId: string,
  maxRounds: number,
): Promise<TaskRun> {
  const state = await ctx.listState();
  const now = new Date().toISOString();
  const taskRun = TaskRunSchema.parse({
    id: createEvidenceStoreId("task"),
    platformId,
    status: "running",
    createdAt: now,
    updatedAt: now,
    maxRounds,
    currentRoundIndex: 0,
  });
  state.taskRuns.push(taskRun);
  await ctx.stateStore.write(state);
  return taskRun;
}

export async function updateTaskRunRecord(
  ctx: EvidenceStoreRecordsContext,
  taskRunId: string,
  status: RuntimeStatus,
  note?: string,
): Promise<TaskRun> {
  const state = await ctx.listState();
  const taskRun = state.taskRuns.find((item) => item.id === taskRunId);
  if (!taskRun) {
    throw new Error(`TaskRun not found: ${taskRunId}`);
  }
  taskRun.status = status;
  taskRun.updatedAt = new Date().toISOString();
  if (note) {
    taskRun.note = note;
  }
  await ctx.stateStore.write(state);
  return TaskRunSchema.parse(taskRun);
}

export async function saveAgentRoundRecord(
  ctx: EvidenceStoreRecordsContext,
  round: AgentRound,
): Promise<AgentRound> {
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

export async function hasSeenVideoVisitRecord(
  ctx: EvidenceStoreRecordsContext,
  taskRunId: string,
  videoVisitId: string,
): Promise<boolean> {
  const state = await ctx.listState();
  return state.agentRounds.some(
    (item) => item.taskRunId === taskRunId && item.videoVisitId === videoVisitId,
  );
}