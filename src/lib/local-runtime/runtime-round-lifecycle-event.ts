import { createId } from "../../lib/local-runtime/ids.js";
import {
  RoundLifecycleEventSchema,
  type RoundLifecycleEvent,
  type RoundLifecycleEventStatus,
  type RoundLifecycleStep,
} from "../../types/evidence-packet.js";

type CreateRoundLifecycleEventInput = {
  sessionId: string;
  taskRunId: string;
  roundId: string;
  videoVisitId?: string | null;
  step: RoundLifecycleStep;
  status: RoundLifecycleEventStatus;
  detail: string;
};

export function createRoundLifecycleEvent(input: CreateRoundLifecycleEventInput): RoundLifecycleEvent {
  return RoundLifecycleEventSchema.parse({
    eventId: createId("round_step"),
    sessionId: input.sessionId,
    taskRunId: input.taskRunId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId ?? null,
    step: input.step,
    status: input.status,
    detail: input.detail,
    createdAt: new Date().toISOString(),
  });
}