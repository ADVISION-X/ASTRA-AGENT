import type { PlatformAdapter } from "../../../lib/local-runtime/platform-runtime-contract.js";
import type { ActionLog, PlatformActionResult } from "../../../types/platform-action.js";
import type { EvidenceRef } from "../../../types/evidence.js";
import type { RoundLifecycleStep } from "../../../types/evidence-packet.js";
import { createActionRequest } from "../../../lib/local-runtime/runtime-action-support.js";
import { StepTimeoutError, STEP_TIMEOUT_MS } from "./state.js";

export async function runWithStepTimeout<T>(input: {
  taskRunId: string;
  roundId: string;
  step: RoundLifecycleStep;
  timeoutMs: number;
  videoVisitId?: string | null;
  emitStepTimeout: (input: { taskRunId: string; roundId: string; step: RoundLifecycleStep; durationMs: number; reviewRequiredReason: string; videoVisitId?: string | null }) => Promise<void>;
}, operation: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const durationMs = Date.now() - startedAt;
          const reviewRequiredReason = `${input.step} exceeded ${input.timeoutMs}ms`;
          void input.emitStepTimeout({ taskRunId: input.taskRunId, roundId: input.roundId, step: input.step, durationMs, reviewRequiredReason, videoVisitId: input.videoVisitId ?? null }).finally(() => {
            reject(new StepTimeoutError({ currentStep: input.step, taskRunId: input.taskRunId, roundId: input.roundId, durationMs, videoVisitId: input.videoVisitId ?? null, reviewRequiredReason }));
          });
        }, input.timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function continueToNextVideo(input: {
  taskRunId: string;
  roundId: string;
  reason: string;
  videoVisitId?: string | null;
  adapter: PlatformAdapter;
  platformId: string;
  recordRoundLifecycleStep: (input: { taskRunId: string; roundId: string; step: "scroll_next_video"; status: "entered"; detail: string; videoVisitId?: string | null }) => Promise<void>;
  runWithStepTimeout: <T>(input: { taskRunId: string; roundId: string; step: RoundLifecycleStep; timeoutMs: number; videoVisitId?: string | null }, operation: () => Promise<T>) => Promise<T>;
}): Promise<PlatformActionResult> {
  await input.recordRoundLifecycleStep({ taskRunId: input.taskRunId, roundId: input.roundId, step: "scroll_next_video", status: "entered", detail: input.reason, videoVisitId: input.videoVisitId ?? null });
  return input.runWithStepTimeout({ taskRunId: input.taskRunId, roundId: input.roundId, step: "scroll_next_video", timeoutMs: STEP_TIMEOUT_MS.scroll_next_video, videoVisitId: input.videoVisitId ?? null }, () => input.adapter.continueNext(createActionRequest({ taskRunId: input.taskRunId, roundId: input.roundId, platformId: input.platformId, type: "continue_next", target: "feed", reason: input.reason })));
}

export async function continueAfterSkipRound(input: {
  taskRunId: string;
  roundId: string;
  reason: string;
  videoVisitId?: string | null;
  continueToNextVideo: (input: { taskRunId: string; roundId: string; reason: string; videoVisitId?: string | null }) => Promise<PlatformActionResult>;
  appendActionLog: (taskRunId: string, roundId: string, actionType: ActionLog["actionType"], status: ActionLog["status"], message: string, evidenceRefs: EvidenceRef[], aiTaskRefs: string[]) => Promise<ActionLog>;
}): Promise<ActionLog> {
  const actionResult = await input.continueToNextVideo({ taskRunId: input.taskRunId, roundId: input.roundId, reason: input.reason, videoVisitId: input.videoVisitId ?? null });
  return input.appendActionLog(input.taskRunId, input.roundId, actionResult.type, actionResult.status, actionResult.message, [], []);
}