import type { EvidenceStoreService } from "../../../../lib/storage/evidence-store/evidence-store-service.js";
import { finalizeRoundArtifacts } from "./finalize-runtime-round.js";
import type { ActionLog } from "../../../../types/platform-action.js";
import type { AgentRound } from "../../../../types/task-run.js";
import type { RoundLifecycleStep } from "../../../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../../../types/runtime.js";

type RoundLog = Awaited<ReturnType<typeof finalizeRoundArtifacts>>;

export function syncLatestActionLog(deliveryState: RuntimeDeliveryState, actionLog: ActionLog): void {
  deliveryState.latestActionLogId = actionLog.id;
  deliveryState.latestActionResult = `${actionLog.actionType}:${actionLog.status}:${actionLog.message}`;
}

export async function finalizeRoundArtifact(input: Parameters<typeof finalizeRoundArtifacts>[0]): Promise<RoundLog> {
  return finalizeRoundArtifacts(input);
}

export async function persistRoundArtifactOutcome(input: {
  evidenceStore: EvidenceStoreService;
  recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: RoundLifecycleStep; status: "completed"; detail: string; videoVisitId?: string | null }) => Promise<void>;
  taskRunId: string;
  roundId: string;
  round: AgentRound;
  roundLog: RoundLog;
  roundStatus: AgentRound["status"];
  note: string;
  completionStep: RoundLifecycleStep;
  videoVisitId?: string | null;
}): Promise<void> {
  input.round.status = input.roundStatus;
  input.round.note = input.note;
  input.round.roundOutcome = input.roundLog.roundOutcome;
  input.round.decisionReason = input.roundLog.decisionReason;
  input.round.nextStep = input.roundLog.nextStep;
  if (input.roundLog.packetId) input.round.packetId = input.roundLog.packetId;
  input.round.updatedAt = new Date().toISOString();
  await input.evidenceStore.saveAgentRound(input.round);
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: input.completionStep, status: "completed", detail: input.roundLog.roundOutcome, videoVisitId: input.videoVisitId ?? null });
}