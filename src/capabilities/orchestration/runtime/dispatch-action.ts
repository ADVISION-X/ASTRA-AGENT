import { getRegisteredAbilityById } from "../../../muscle-memory/catalog.js";
import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import { applyMissionStatus, getMissionState, upsertMissionState } from "./mission-state.js";
import { dispatchSingleAction } from "./dispatch-executor.js";
import { appendDispatchEvidence } from "./dispatch-forensics.js";
import { emitDispatchCompleted, emitDispatchStarted } from "./dispatch-log.js";
import type { DispatchSequenceContext, DispatchSequenceResult } from "./dispatch-types.js";

export type { DispatchSequenceContext, DispatchSequenceResult } from "./dispatch-types.js";

const failMissionAfterEvidence = (
  input: DispatchRegisteredAbilityActionInput,
  reason: string,
): DispatchSequenceResult => {
  const updated = applyMissionStatus(getMissionState(input.missionId), { status: "failed", failureReason: reason });
  upsertMissionState(updated);
  return { status: "failed", stateSnapshot: updated, failureReason: reason, reviewRequiredReason: null };
};

const resolveDispatchState = (
  input: DispatchRegisteredAbilityActionInput,
  result: { status: "success" | "failed" | "review_required"; failureReason: string | null },
): DispatchSequenceResult => {
  if (result.status === "failed" && input.action.required !== false) {
    return failMissionAfterEvidence(input, result.failureReason ?? "action failed");
  }
  if (result.status === "review_required") {
    const reason = `Action ${input.action.actionCode} requires review`;
    const updated = applyMissionStatus(getMissionState(input.missionId), { status: "review_required", reviewRequiredReason: reason });
    upsertMissionState(updated);
    return { status: "review_required", stateSnapshot: updated, failureReason: null, reviewRequiredReason: reason };
  }
  return { status: "success", stateSnapshot: getMissionState(input.missionId), failureReason: null, reviewRequiredReason: null };
};

export async function dispatchRegisteredAbilityAction(
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
): Promise<DispatchSequenceResult> {
  const action = input.action;
  emitDispatchStarted(input, ctx.runtimeLogger);
  const result = await dispatchSingleAction(action, input, ctx, 0);
  emitDispatchCompleted(input, result, ctx.runtimeLogger);

  const evidenceResult = await appendDispatchEvidence({
    input,
    forensics: ctx.forensics,
    entry: getRegisteredAbilityById(action.actionCode),
    status: result.status,
    failureReason: result.failureReason,
  });
  if (evidenceResult.status !== "success") {
    return failMissionAfterEvidence(input, evidenceResult.failureReason ?? "Forensics appendRecord failed after action dispatch");
  }
  return resolveDispatchState(input, result);
}
