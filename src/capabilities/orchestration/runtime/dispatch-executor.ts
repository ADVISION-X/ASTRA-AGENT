import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import { getRegisteredAbilityById } from "../../../muscle-memory/catalog.js";
import { resolveGeometryProof } from "./dispatch-geometry.js";
import { emitAbilityActionResult } from "./dispatch-log.js";
import { buildDispatchInputPayload } from "./dispatch-payload.js";
import type { DispatchAction, DispatchSequenceContext, DispatchSingleResult } from "./dispatch-types.js";

const cleanActionInput = (actionInput: Record<string, unknown>): Record<string, unknown> => {
  const { gridCell: _gridCell, cellZone: _cellZone, ...cleanInput } = actionInput;
  return cleanInput;
};

const prepareActionInput = async (
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
  requiresGeometryProof: boolean,
): Promise<{ ok: true; actionInput: Record<string, unknown> } | { ok: false; result: DispatchSingleResult }> => {
  const baseInput = { ...(action.input ?? {}) };
  if (!requiresGeometryProof) return { ok: true, actionInput: cleanActionInput(baseInput) };
  const geoResult = await resolveGeometryProof(action, input, ctx);
  if (geoResult.ok) return { ok: true, actionInput: cleanActionInput({ ...baseInput, ...geoResult.proof }) };
  const result = action.required === false
    ? { status: "success" as const, failureReason: null }
    : { status: "failed" as const, failureReason: geoResult.failureReason };
  return { ok: false, result };
};

export const dispatchSingleAction = async (
  action: DispatchAction,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
  actionIndex: number,
): Promise<DispatchSingleResult> => {
  const entry = getRegisteredAbilityById(action.actionCode);
  if (!entry) return { status: "failed", failureReason: `Action ${action.actionCode} not registered in MuscleMemory catalog` };
  const prepared = await prepareActionInput(action, input, ctx, entry.requiresGeometryProof);
  if (!prepared.ok) return prepared.result;
  const inputPayload = buildDispatchInputPayload({
    action,
    input,
    actionInput: prepared.actionInput,
    actionIndex,
    abilityGroupId: entry.abilityGroupId,
    childCapabilityId: entry.childCapabilityId,
  });
  try {
    const result = await ctx.nerveBus.dispatchAbilityCommand({
      abilityGroupId: entry.abilityGroupId,
      childCapabilityId: entry.childCapabilityId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: null,
      roundId: input.roundId ?? null,
      inputPayload,
    });
    emitAbilityActionResult(input, action, result.status ?? "success", ctx.runtimeLogger);
    return { status: result.status ?? "success", failureReason: result.failureReason ?? null };
  } catch (error) {
    return { status: "failed", failureReason: error instanceof Error ? error.message : String(error) };
  }
};
