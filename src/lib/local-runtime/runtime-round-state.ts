import { AgentRoundSchema, type AgentRound } from "../../types/task-run.js";

export function createPendingRound(taskRunId: string, roundId: string, index: number): AgentRound {
  const now = new Date().toISOString();
  return AgentRoundSchema.parse({ id: roundId, taskRunId, index, status: "pending", createdAt: now, updatedAt: now, actionLogIds: [] });
}

export function markRoundObserved(round: AgentRound, videoVisitId: string): void {
  round.videoId = videoVisitId;
  round.videoVisitId = videoVisitId;
  round.status = "observed";
  round.updatedAt = new Date().toISOString();
}