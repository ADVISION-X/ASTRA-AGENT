import { randomUUID } from "node:crypto";
import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState } from "../contract.js";
import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import type { GeometryGuardAbilityGroup } from "../../geometry-guard/index.js";
import type {
  ScreenshotAbilityGroup,
  ScreenshotGridSpec,
} from "../../screenshot/index.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";

import { getMissionState, upsertMissionState, applyMissionStatus } from "./mission-state.js";
import { getRegisteredAbilityById } from "../../../muscle-memory/catalog.js";
import {
  decodeGridCell,
  resolveScreenshotStructuredDataRefPayload,
} from "../../screenshot/index.js";

export type DispatchSequenceContext = {
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsPersistenceAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
  screenshotAbilityGroup: ScreenshotAbilityGroup;
  runtimeLogger: RuntimeLogger;
};

export type DispatchSequenceResult = {
  status: "success" | "failed" | "review_required";
  stateSnapshot: MissionState;
  failureReason: string | null;
  reviewRequiredReason: string | null;
};

type Action = DispatchRegisteredAbilityActionInput["action"];
type CellZone = NonNullable<Action["cellZone"]>;

const CELL_ZONE_OFFSETS: Record<CellZone, { xRatio: number; yRatio: number }> = {
  top_left: { xRatio: 1 / 6, yRatio: 1 / 6 },
  top_center: { xRatio: 1 / 2, yRatio: 1 / 6 },
  top_right: { xRatio: 5 / 6, yRatio: 1 / 6 },
  middle_left: { xRatio: 1 / 6, yRatio: 1 / 2 },
  middle_center: { xRatio: 1 / 2, yRatio: 1 / 2 },
  center: { xRatio: 1 / 2, yRatio: 1 / 2 },
  middle_right: { xRatio: 5 / 6, yRatio: 1 / 2 },
  bottom_left: { xRatio: 1 / 6, yRatio: 5 / 6 },
  bottom_center: { xRatio: 1 / 2, yRatio: 5 / 6 },
  bottom_right: { xRatio: 5 / 6, yRatio: 5 / 6 },
};

function resolveCellZoneClickPoint(
  bbox: { x: number; y: number; width: number; height: number },
  cellZone: CellZone | null | undefined,
): { x: number; y: number } {
  const offset = CELL_ZONE_OFFSETS[cellZone ?? "center"] ?? CELL_ZONE_OFFSETS.center;
  return {
    x: bbox.x + bbox.width * offset.xRatio,
    y: bbox.y + bbox.height * offset.yRatio,
  };
}

/**
 * Run Geometry Guard preflight for a click action that requiresGeometryProof.
 * Decodes gridCell → bbox using the registered gridSpec, then validates.
 * Returns the proof fields to merge into action input, or a failure reason.
 */
async function resolveGeometryProof(
  action: Action,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
): Promise<{ ok: true; proof: Record<string, unknown> } | { ok: false; failureReason: string }> {
  const gridCell =
    (action.gridCell) ??
    (action.input?.["gridCell"] as string | undefined) ??
    null;
  const cellZone = action.cellZone ?? (action.input?.["cellZone"] as CellZone | undefined) ?? "center";
  if (!gridCell) {
    return { ok: false, failureReason: `Action ${action.actionCode} requires geometry proof but no gridCell provided` };
  }
  const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;

  // Decode gridCell → bbox using the registered gridSpec.
  let bbox: { x: number; y: number; width: number; height: number } | null = null;
  let viewportSize: { width: number; height: number } | null = null;
  if (gridSpecRef) {
    const gridSpec = resolveScreenshotStructuredDataRefPayload<ScreenshotGridSpec>(gridSpecRef);
    if (gridSpec) {
      try {
        const cell = decodeGridCell(gridSpec, gridCell);
        bbox = { x: cell.x, y: cell.y, width: cell.width, height: cell.height };
      } catch {
        return { ok: false, failureReason: `gridCell "${gridCell}" not found in gridSpec ${gridSpecRef}` };
      }
      viewportSize = { width: gridSpec.sourceWidth, height: gridSpec.sourceHeight };
    }
  }

  let guardResult: Awaited<ReturnType<typeof ctx.geometryGuard.execute>>;
  try {
    guardResult = await ctx.geometryGuard.execute({
      abilityGroupId: "geometry-guard",
      childCapabilityId: "validate-click-grid-cell",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId ?? null,
      ...(gridSpecRef ? { gridSpecRef } : {}),
      ...(bbox ? { bbox } : {}),
      ...(bbox ? { clickPoint: resolveCellZoneClickPoint(bbox, cellZone) } : {}),
      ...(viewportSize ? { viewportSize } : {}),
      sourceCoordinateSpace: "grid",
      requestedExecutionSpace: "browserViewport",
      idempotencyKey: `geometry:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${action.actionCode}:${gridCell}:${cellZone}`,
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

  const normalizedBbox = guardResult.normalizedBbox;
  ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "GEOMETRY_GUARD_RESULT",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: "success",
    reason: `geometry guard allow for ${action.actionCode} gridCell=${gridCell ?? "?"} cellZone=${cellZone}`,
    refs: { actionCode: action.actionCode },
  });
  return {
    ok: true,
    proof: {
      geometryGuardRef: guardResult.geometryGuardRef,
      geometryGuardProofRef: guardResult.runtimeProof.proofId,
      geometryGuardOutputRef: guardResult.output?.outputRef ?? guardResult.geometryGuardRef,
      guardDecision: "allow" as const,
      geometryGuardNormalizedCoordinateSpace: "browserViewport" as const,
      geometryGuardNormalizedClickPoint: guardResult.normalizedClickPoint,
      // bounds = {width, height} only — mouse-click positiveDims is strict
      ...(normalizedBbox ? { bounds: { width: normalizedBbox.width, height: normalizedBbox.height } } : {}),
      sourceCoordinateProofRef: guardResult.geometryGuardRef,
    },
  };
}

async function dispatchSingleAction(
  action: Action,
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
  actionIndex: number,
): Promise<{ status: "success" | "failed" | "review_required"; failureReason: string | null }> {
  // ── 1. Resolve abilityGroupId + childCapabilityId from MuscleMemory ────────
  const entry = getRegisteredAbilityById(action.actionCode);
  if (!entry) {
    return { status: "failed", failureReason: `Action ${action.actionCode} not registered in MuscleMemory catalog` };
  }
  const resolvedAbilityGroupId = entry.abilityGroupId;
  const resolvedChildCapabilityId = entry.childCapabilityId;

  // ── 2. Geometry Guard preflight for an action requiring coordinate proof ───
  let actionInput: Record<string, unknown> = { ...(action.input ?? {}) };
  if (entry.requiresGeometryProof) {
    const geoResult = await resolveGeometryProof(action, input, ctx);
    if (!geoResult.ok) {
      if (action.required === false) {
        return { status: "success", failureReason: null }; // non-required: skip gracefully
      }
      return { status: "failed", failureReason: geoResult.failureReason };
    }
    actionInput = { ...actionInput, ...geoResult.proof };
  }

  // ── 3. Dispatch to ability group via Nerve Bus ────────────────────────────
  // Build complete input — NerveBus is pure transport after P0-4; ability-group schemas
  // require all fields to be present in action input before dispatch.
  // Strip action-routing fields (gridCell) that were only needed for geometry proof
  // resolution and must not be forwarded to strict ability group schemas.
  const { gridCell: _strippedGridCell, cellZone: _strippedCellZone, ...cleanInput } = actionInput as Record<string, unknown>;
  const callId = randomUUID();
  const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;
  const baseInput: Record<string, unknown> = {
    ...cleanInput,
    abilityGroupId: resolvedAbilityGroupId,
    childCapabilityId: resolvedChildCapabilityId,
    missionId: input.missionId,
    runId: input.runId,
    sessionId: "local",
    roundId: input.roundId ?? null,
    videoVisitId: null,
    stepId: randomUUID(),
    capabilityCallId: callId,
    nerveBusEnvelopeId: callId,
    requestedBy: "orchestration:dispatch-action",
    purpose: `execute:${action.actionCode}`,
    inputRef: randomUUID(),
    sourceRef: actionInput["sourceRef"] ?? gridSpecRef ?? callId,
    sourceEvidenceRef: actionInput["sourceEvidenceRef"] ?? (input.currentEvidenceRefs?.["originalScreenshotRef"] as string | undefined) ?? null,
    idempotencyKey: actionInput["idempotencyKey"] ?? [
      "dispatch",
      input.missionId,
      input.runId,
      input.roundId ?? "noround",
      String(actionIndex),
      action.actionCode,
      action.gridCell ?? "nogrid",
      action.cellZone ?? "center",
    ].join(":"),
  };
  const completeInput = resolvedAbilityGroupId === "forensics-persistence" && resolvedChildCapabilityId === "append-record"
    ? {
        ...baseInput,
        childCapabilityId: "append-record",
        recordType: cleanInput["recordType"] ?? "visual_evidence",
        recordPayload: {
          ...cleanInput,
          reason: action.reason ?? null,
          aiResultRef: input.aiResultRef ?? null,
          originalScreenshotRef: input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
          coordinateGridScreenshotRef: input.currentEvidenceRefs?.["coordinateGridScreenshotRef"] ?? null,
          gridSpecRef: input.currentEvidenceRefs?.["gridSpecRef"] ?? null,
        },
      }
    : baseInput;
  const dispatchInputPayload = resolvedAbilityGroupId === "text-input"
    ? {
        abilityGroupId: resolvedAbilityGroupId,
        childCapabilityId: resolvedChildCapabilityId,
        missionId: input.missionId,
        runId: input.runId,
        sessionId: "local",
        roundId: input.roundId ?? null,
        stepId: completeInput["stepId"],
        capabilityCallId: completeInput["capabilityCallId"],
        nerveBusEnvelopeId: completeInput["nerveBusEnvelopeId"],
        inputRef: completeInput["inputRef"],
        targetRef: cleanInput["targetRef"] ?? null,
        focusRef: cleanInput["focusRef"] ?? null,
        idempotencyKey: completeInput["idempotencyKey"],
        ...(cleanInput["timeoutMs"] ? { timeoutMs: cleanInput["timeoutMs"] } : {}),
        approvedText: cleanInput["approvedText"] ?? null,
        approvedKey: cleanInput["approvedKey"] ?? null,
      }
    : completeInput;
  try {
    const result = await ctx.nerveBus.dispatchAbilityCommand({
      abilityGroupId: resolvedAbilityGroupId,
      childCapabilityId: resolvedChildCapabilityId,
      missionId: input.missionId,
      runId: input.runId,
      sessionId: null,
      roundId: input.roundId ?? null,
      inputPayload: dispatchInputPayload,
    });
    const dispatchStatus = result.status ?? "success";
    if (resolvedAbilityGroupId === "mouse-click" || resolvedAbilityGroupId === "mouse-scroll") {
      ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: dispatchStatus === "success" ? "debug" : "warn",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "BROWSER_ACTION_RESULT",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.roundId ? { roundId: input.roundId } : {}),
        status: dispatchStatus,
        reason: dispatchStatus === "success"
          ? `${action.actionCode} ok`
          : `${action.actionCode} ${dispatchStatus}: ${result.failureReason ?? "unknown"}`,
        refs: { actionCode: action.actionCode },
      });
    } else if (resolvedAbilityGroupId === "text-input") {
      ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: dispatchStatus === "success" ? "debug" : "warn",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "TEXT_INPUT_RESULT",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.roundId ? { roundId: input.roundId } : {}),
        status: dispatchStatus,
        reason: dispatchStatus === "success"
          ? `${action.actionCode} ok`
          : `${action.actionCode} ${dispatchStatus}: ${result.failureReason ?? "unknown"}`,
        refs: { actionCode: action.actionCode },
      });
    }
    return { status: dispatchStatus, failureReason: result.failureReason ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "failed", failureReason: msg };
  }
}

export async function dispatchRegisteredAbilityAction(
  input: DispatchRegisteredAbilityActionInput,
  ctx: DispatchSequenceContext,
): Promise<DispatchSequenceResult> {
  const action = input.action;
  ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "CAPABILITY_DISPATCH_STARTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: "started",
    reason: `Dispatching ${action.actionCode}${action.gridCell ? ` at ${action.gridCell}` : ""}${action.cellZone ? ` zone=${action.cellZone}` : ""}`,
  });

  const { status, failureReason } = await dispatchSingleAction(action, input, ctx, 0);

  ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: status === "success" ? "info" : status === "review_required" ? "warn" : "error",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: status === "success" ? "CAPABILITY_DISPATCH_COMPLETED" : "CAPABILITY_DISPATCH_FAILED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status,
    reason: status === "success"
      ? `${action.actionCode} ok${action.gridCell ? ` at ${action.gridCell}` : ""}${action.cellZone ? ` zone=${action.cellZone}` : ""}`
      : `${action.actionCode} ${status}: ${failureReason ?? "unknown"}`,
  });

  const entry = getRegisteredAbilityById(action.actionCode);
  const evidenceResult = await ctx.forensics.appendRecord({
    childCapabilityId: "append-record",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId ?? undefined,
    sourceCapabilityId: "orchestration",
    sourceChildCapabilityId: "dispatch-registered-ability-action",
    recordType: "ability_result",
    recordPayload: {
      actionCode: action.actionCode,
      reason: action.reason ?? (action.input?.["reason"] as string | undefined) ?? null,
      gridCell: action.gridCell ?? (action.input?.["gridCell"] as string | undefined) ?? null,
      cellZone: action.cellZone ?? (action.input?.["cellZone"] as string | undefined) ?? null,
      abilityGroupId: entry ? entry.abilityGroupId : null,
      childCapabilityId: entry ? entry.childCapabilityId : null,
      status,
      failureReason: failureReason ?? null,
    },
    idempotencyKey: `orchestration:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${action.actionCode}`,
  });
  if (evidenceResult.status !== "success") {
    const failedState = getMissionState(input.missionId);
    const reason = evidenceResult.failureReason ?? "Forensics appendRecord failed after action dispatch";
    const updated = applyMissionStatus(failedState, { status: "failed", failureReason: reason });
    upsertMissionState(updated);
    return { status: "failed", stateSnapshot: updated, failureReason: reason, reviewRequiredReason: null };
  }

  if (status === "failed" && action.required !== false) {
    const failedState = getMissionState(input.missionId);
    const updated = applyMissionStatus(failedState, { status: "failed", failureReason: failureReason ?? "action failed" });
    upsertMissionState(updated);
    return { status: "failed", stateSnapshot: updated, failureReason: failureReason ?? "action failed", reviewRequiredReason: null };
  }
  if (status === "review_required") {
    const current2 = getMissionState(input.missionId);
    const updated2 = applyMissionStatus(current2, { status: "review_required", reviewRequiredReason: `Action ${action.actionCode} requires review` });
    upsertMissionState(updated2);
    return { status: "review_required", stateSnapshot: updated2, failureReason: null, reviewRequiredReason: `Action ${action.actionCode} requires review` };
  }
  return { status: "success", stateSnapshot: getMissionState(input.missionId), failureReason: null, reviewRequiredReason: null };
}
