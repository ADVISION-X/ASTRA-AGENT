import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";

type RegisteredAbilityEntry = {
  abilityGroupId: string;
  childCapabilityId: string;
} | null;

type AppendDispatchEvidenceInput = {
  input: DispatchRegisteredAbilityActionInput;
  forensics: ForensicsPersistenceAbilityGroup;
  entry: RegisteredAbilityEntry;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
};

export const appendDispatchEvidence = (payload: AppendDispatchEvidenceInput) => {
  const action = payload.input.action;
  return payload.forensics.appendRecord({
    childCapabilityId: "append-record",
    missionId: payload.input.missionId,
    runId: payload.input.runId,
    roundId: payload.input.roundId ?? undefined,
    sourceCapabilityId: "orchestration",
    sourceChildCapabilityId: "dispatch-registered-ability-action",
    recordType: "ability_result",
    recordPayload: {
      actionCode: action.actionCode,
      reason: action.reason ?? (action.input?.["reason"] as string | undefined) ?? null,
      gridCell: action.gridCell ?? (action.input?.["gridCell"] as string | undefined) ?? null,
      cellZone: action.cellZone ?? (action.input?.["cellZone"] as string | undefined) ?? null,
      abilityGroupId: payload.entry ? payload.entry.abilityGroupId : null,
      childCapabilityId: payload.entry ? payload.entry.childCapabilityId : null,
      status: payload.status,
      failureReason: payload.failureReason ?? null,
    },
    idempotencyKey: `orchestration:${payload.input.missionId}:${payload.input.runId}:${payload.input.roundId ?? ""}:${action.actionCode}`,
  });
};
