import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState } from "../contract.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import type { GeometryGuardAbilityGroup } from "../../geometry-guard/index.js";
import { getMissionState, upsertMissionState, applyStatusTransition } from "./mission-state.js";
import { findMuscleMemoryEntry } from "../../../muscle-memory/catalog.js";

export type DispatchSequenceContext = {
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsPersistenceAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
};

export type DispatchSequenceResult = {
  status: "success" | "failed" | "review_required";
  stateSnapshot: MissionState;
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

type Action = DispatchRegisteredAbilitySequenceInput["actions"][number];

/**
 * Run Geometry Guard preflight for click actions that requiresGeometryProof.
 * Returns the proof fields to merge into inputOverrides, or a failure reason.
 */
async function resolveGeometryProof(
  action: Action,
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
): Promise<{ ok: true; proof: Record<string, unknown> } | { ok: false; failureReason: string }> {
  const gridCell =
    (action.gridCell) ??
    (action.inputOverrides?.["gridCell"] as string | undefined) ??
    null;
  if (!gridCell) {
    return { ok: false, failureReason: `Action ${action.actionCode} requires geometry proof but no gridCell provided` };
  }
  const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"]) ?? null;

  let guardResult: Awaited<ReturnType<typeof ctx.geometryGuard.execute>>;
  try {
    guardResult = await ctx.geometryGuard.execute({
      abilityGroupId: "geometry-guard",
      childCapabilityId: "validate-click-grid-cell",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId ?? null,
      ...(gridSpecRef ? { gridSpecRef } : {}),
      sourceCoordinateSpace: "grid",
      requestedExecutionSpace: "browserViewport",
      idempotencyKey: `geometry:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${action.actionCode}:${gridCell}`,
    });
  } catch (err) {
    return { ok: false, failureReason: `Geometry Guard threw for ${action.actionCode}: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (guardResult.guardDecision === "review_required") {
    return { ok: false, failureReason: `Geometry Guard review_required for ${action.actionCode}: ${guardResult.reviewRequiredReason ?? "review required"}` };
  }
  if (guardResult.guardDecision !== "allow" || !guardResult.normalizedClickPoint) {
    return { ok: false, failureReason: `Geometry Guard denied ${action.actionCode}: ${guardResult.failureReason ?? "deny"}` };
  }

  return {
    ok: true,
    proof: {
      geometryGuardRef: guardResult.geometryGuardRef,
      geometryGuardProofRef: guardResult.runtimeProof.proofId,
      geometryGuardOutputRef: guardResult.output?.outputRef ?? guardResult.geometryGuardRef,
      guardDecision: "allow" as const,
      geometryGuardNormalizedClickPoint: guardResult.normalizedClickPoint,
      ...(guardResult.normalizedBbox ? { bounds: guardResult.normalizedBbox } : {}),
      sourceCoordinateProofRef: guardResult.geometryGuardRef,
    },
  };
}

async function dispatchSingleAction(
  action: Action,
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
): Promise<{ status: "success" | "failed" | "review_required"; failureReason: string | null }> {
  // ── 1. Resolve abilityGroupId + childCapabilityId from MuscleMemory ────────
  const entry = findMuscleMemoryEntry(action.actionCode);
  if (!entry) {
    return { status: "failed", failureReason: `Action ${action.actionCode} not registered in MuscleMemory catalog` };
  }
  const resolvedAbilityGroupId = action.abilityGroupId ?? entry.abilityGroupId;
  const resolvedChildCapabilityId = action.childCapabilityId ?? entry.childCapabilityId;

  // ── 2. Special handler: SAVE_CURRENT_VIDEO_EVIDENCE_ONCE ──────────────────
  if (action.actionCode === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE") {
    const evidenceLabel = (action.inputOverrides?.["evidenceLabel"] as string | undefined) ?? "video-evidence";
    const reason = (action.inputOverrides?.["reason"] as string | undefined) ?? "AI requested evidence save";
    try {
      await ctx.forensics.appendRecord({
        childCapabilityId: "append-record",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.roundId ? { roundId: input.roundId } : {}),
        sourceCapabilityId: "orchestration",
        sourceChildCapabilityId: "dispatch-registered-ability-sequence",
        recordType: "evidence",
        recordPayload: {
          actionCode: action.actionCode,
          evidenceLabel,
          reason,
          aiResultRef: input.aiResultRef ?? null,
          originalScreenshotRef: input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
          coordinateGridScreenshotRef: input.currentEvidenceRefs?.["coordinateGridScreenshotRef"] ?? null,
          gridSpecRef: input.currentEvidenceRefs?.["gridSpecRef"] ?? null,
          missionId: input.missionId,
          runId: input.runId,
          roundId: input.roundId ?? null,
        },
        idempotencyKey: `save-evidence:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${evidenceLabel}`,
      });
      return { status: "success", failureReason: null };
    } catch (err) {
      return { status: "failed", failureReason: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── 3. Geometry Guard preflight for actions requiring coordinate proof ─────
  let inputOverrides: Record<string, unknown> = { ...(action.inputOverrides ?? {}) };
  if (entry.requiresGeometryProof) {
    const geoResult = await resolveGeometryProof(action, input, ctx);
    if (!geoResult.ok) {
      if (action.required === false) {
        return { status: "success", failureReason: null }; // non-required: skip gracefully
      }
      return { status: "failed", failureReason: geoResult.failureReason };
    }
    inputOverrides = { ...inputOverrides, ...geoResult.proof };
  }

  // ── 4. Dispatch to ability group via Nerve Bus ────────────────────────────
  try {
    const result = await ctx.nerveBus.dispatchAbilityCommand({
      abilityGroupId: resolvedAbilityGroupId,
      childCapabilityId: resolvedChildCapabilityId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: null,
      roundId: input.roundId ?? null,
      inputOverrides,
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
