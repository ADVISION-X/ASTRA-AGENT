import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState } from "../contract.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import { getMissionState, upsertMissionState, applyStatusTransition } from "./mission-state.js";

export type DispatchSequenceContext = {
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsPersistenceAbilityGroup;
};

export type DispatchSequenceResult = {
  status: "success" | "failed" | "review_required";
  stateSnapshot: MissionState;
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

type Action = DispatchRegisteredAbilitySequenceInput["actions"][number];

async function dispatchSingleAction(
  action: Action,
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
): Promise<{ status: "success" | "failed" | "review_required"; failureReason: string | null }> {
  if (!action.abilityGroupId || !action.childCapabilityId) {
    return { status: "failed", failureReason: `Action ${action.actionCode} missing abilityGroupId or childCapabilityId` };
  }
  try {
    const result = await ctx.nerveBus.dispatchAbilityCommand({
      abilityGroupId: action.abilityGroupId,
      childCapabilityId: action.childCapabilityId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: null,
      roundId: input.roundId ?? null,
      inputOverrides: action.inputOverrides ?? {},
    });
    return { status: result.status ?? "success", failureReason: result.failureReason ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", failureReason: msg };
  }
}

export async function dispatchRegisteredAbilitySequence(
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
): Promise<DispatchSequenceResult> {
  for (const action of input.actions) {
    const { status, failureReason } = await dispatchSingleAction(action, input, ctx);

    void ctx.forensics.appendRecord({
      childCapabilityId: "append-record",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId ?? undefined,
      sourceCapabilityId: "orchestration",
      sourceChildCapabilityId: "dispatch-registered-ability-sequence",
      recordType: "ability_result",
      recordPayload: {
        actionCode: action.actionCode,
        abilityGroupId: action.abilityGroupId ?? null,
        childCapabilityId: action.childCapabilityId ?? null,
        status,
        failureReason: failureReason ?? null,
      },
      idempotencyKey: `orchestration:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${action.actionCode}`,
    }).catch(() => { /* forensics failure must not block dispatch */ });

    if (status === "failed" && action.required !== false) {
      const failedState = getMissionState(input.missionId);
      const updated = applyStatusTransition(failedState, { status: "failed", failureReason: failureReason ?? "action failed" });
      upsertMissionState(updated);
      return { status: "failed", stateSnapshot: updated, failureReason: failureReason ?? "action failed", reviewRequiredReason: null };
    }
    if (status === "review_required") {
      const current2 = getMissionState(input.missionId);
      const updated2 = applyStatusTransition(current2, { status: "review_required", reviewRequiredReason: `Action ${action.actionCode} requires review` });
      upsertMissionState(updated2);
      return { status: "review_required", stateSnapshot: updated2, failureReason: null, reviewRequiredReason: `Action ${action.actionCode} requires review` };
    }
  }

  const finalState = getMissionState(input.missionId);
  const updated = applyStatusTransition(finalState, { roundIndexDelta: 1, status: "running" });
  upsertMissionState(updated);
  return { status: "success", stateSnapshot: updated, failureReason: null, reviewRequiredReason: null };
}
