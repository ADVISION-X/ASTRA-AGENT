import { randomUUID } from "node:crypto";
import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState } from "../contract.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import type { GeometryGuardAbilityGroup } from "../../geometry-guard/index.js";
import type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";

import { getMissionState, upsertMissionState, applyStatusTransition } from "./mission-state.js";
import { findMuscleMemoryEntry } from "../../../muscle-memory/catalog.js";
import { resolveScreenshotStructuredDataRefPayload } from "../../screenshot/runtime/structured-ref-store.js";
import type { ScreenshotGridSpec } from "../../screenshot/contract.js";
import { decodeGridCell } from "../../screenshot/contract.js";

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

type Action = DispatchRegisteredAbilitySequenceInput["actions"][number];
type CellZone = NonNullable<Action["cellZone"]>;

const INTER_ACTION_SETTLE_WAIT_MS = 1_000;

const CELL_ZONE_OFFSETS: Record<CellZone, { xRatio: number; yRatio: number }> = {
  top_left: { xRatio: 1 / 6, yRatio: 1 / 6 },
  top_center: { xRatio: 1 / 2, yRatio: 1 / 6 },
  top_right: { xRatio: 5 / 6, yRatio: 1 / 6 },
  middle_left: { xRatio: 1 / 6, yRatio: 1 / 2 },
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
 * Run Geometry Guard preflight for click actions that requiresGeometryProof.
 * Decodes gridCell → bbox using the registered gridSpec, then validates.
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
  const cellZone = action.cellZone ?? (action.inputOverrides?.["cellZone"] as CellZone | undefined) ?? "center";
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
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
  extras?: { freshScreenshotRef?: string | null; commentPanelOpenAttempted?: boolean; actionIndex?: number },
): Promise<{ status: "success" | "failed" | "review_required"; failureReason: string | null }> {
  // ── 1. Resolve abilityGroupId + childCapabilityId from MuscleMemory ────────
  const entry = findMuscleMemoryEntry(action.actionCode);
  if (!entry) {
    return { status: "failed", failureReason: `Action ${action.actionCode} not registered in MuscleMemory catalog` };
  }
  const resolvedAbilityGroupId = entry.abilityGroupId;
  const resolvedChildCapabilityId = entry.childCapabilityId;

  // ── 2. Catalog-registered handler: SAVE_CURRENT_VIDEO_EVIDENCE_ONCE ───────
  // (catalog check above has already verified this action is registered)
  if (action.actionCode === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE") {
    const evidenceLabel = (action.inputOverrides?.["evidenceLabel"] as string | undefined) ?? "video-evidence";
    const reason = action.reason ?? (action.inputOverrides?.["reason"] as string | undefined) ?? "AI requested evidence save";
    const captureMode = (action.inputOverrides?.["captureMode"] as string | undefined) ?? "use_current_round_screenshot";
    try {
      const evidenceResult = await ctx.forensics.appendRecord({
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
          captureMode,
          aiResultRef: input.aiResultRef ?? null,
          originalScreenshotRef: input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
          coordinateGridScreenshotRef: input.currentEvidenceRefs?.["coordinateGridScreenshotRef"] ?? null,
          gridSpecRef: input.currentEvidenceRefs?.["gridSpecRef"] ?? null,
          ...(extras?.freshScreenshotRef ? { freshScreenshotRef: extras.freshScreenshotRef } : {}),
          ...(extras?.commentPanelOpenAttempted && extras.freshScreenshotRef ? { postCommentScreenshotRef: extras.freshScreenshotRef } : {}),
          missionId: input.missionId,
          runId: input.runId,
          roundId: input.roundId ?? null,
        },
        idempotencyKey: `save-evidence:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${evidenceLabel}`,
      });
      if (evidenceResult.status !== "success") {
        return { status: "failed", failureReason: evidenceResult.failureReason ?? "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE forensics append failed" };
      }
      ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "FORENSICS_RECORD_APPENDED",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.roundId ? { roundId: input.roundId } : {}),
        status: "success",
        reason: `SAVE_CURRENT_VIDEO_EVIDENCE_ONCE evidenceLabel=${evidenceLabel}`,
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
  // Build complete input — NerveBus is pure transport after P0-4; ability-group schemas
  // require all fields to be present in inputOverrides before dispatch.
  // Strip action-routing fields (gridCell) that were only needed for geometry proof
  // resolution and must not be forwarded to strict ability group schemas.
  const { gridCell: _strippedGridCell, cellZone: _strippedCellZone, ...cleanOverrides } = inputOverrides as Record<string, unknown>;
  const callId = randomUUID();
  const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;
  const completeInput: Record<string, unknown> = {
    ...cleanOverrides,
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
    requestedBy: "orchestration:dispatch-sequence",
    purpose: `execute:${action.actionCode}`,
    inputRef: randomUUID(),
    sourceRef: inputOverrides["sourceRef"] ?? gridSpecRef ?? callId,
    sourceEvidenceRef: inputOverrides["sourceEvidenceRef"] ?? (input.currentEvidenceRefs?.["originalScreenshotRef"] as string | undefined) ?? null,
    idempotencyKey: inputOverrides["idempotencyKey"] ?? [
      "dispatch",
      input.missionId,
      input.runId,
      input.roundId ?? "noround",
      String(extras?.actionIndex ?? "manual"),
      action.actionCode,
      action.targetRole ?? "norole",
      action.gridCell ?? "nogrid",
      action.cellZone ?? "center",
    ].join(":"),
  };
  const dispatchInputOverrides = resolvedAbilityGroupId === "text-input"
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
        targetRef: cleanOverrides["targetRef"] ?? null,
        focusRef: cleanOverrides["focusRef"] ?? null,
        idempotencyKey: completeInput["idempotencyKey"],
        ...(cleanOverrides["timeoutMs"] ? { timeoutMs: cleanOverrides["timeoutMs"] } : {}),
        approvedText: cleanOverrides["approvedText"] ?? null,
        approvedKey: cleanOverrides["approvedKey"] ?? null,
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
      inputOverrides: dispatchInputOverrides,
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

function waitForInterActionSettle() {
  return new Promise<void>((resolve) => setTimeout(resolve, INTER_ACTION_SETTLE_WAIT_MS));
}

export async function dispatchRegisteredAbilitySequence(
  input: DispatchRegisteredAbilitySequenceInput,
  ctx: DispatchSequenceContext,
): Promise<DispatchSequenceResult> {
  // Track whether a comments_button click was requested — used to tag postCommentScreenshotRef in SAVE evidence.
  const commentPanelOpenAttempted = input.actions.some(a => a.targetRole === "comments_button");

  for (const [actionIndex, action] of input.actions.entries()) {
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
      reason: `Dispatching ${action.actionCode}${action.gridCell ? ` at ${action.gridCell}` : ""}${action.cellZone ? ` zone=${action.cellZone}` : ""}${action.targetRole ? ` role=${action.targetRole}` : ""}`,
    });

    // ── Take fresh screenshot before SAVE when captureMode='fresh_current_viewport' ──
    let freshScreenshotRef: string | null = null;
    if (
      action.actionCode === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE" &&
      (action.inputOverrides?.["captureMode"] as string | undefined) === "fresh_current_viewport"
    ) {
      let shotFailed = false;
      let shotFailureReason: string | null = null;
      try {
        const postShot = await ctx.screenshotAbilityGroup.execute({
          childCapabilityId: "capture-browser-viewport",
          missionId: input.missionId,
          runId: input.runId,
          sessionId: null,
          roundId: input.roundId ?? null,
          stepId: randomUUID(),
          capabilityCallId: randomUUID(),
          nerveBusEnvelopeId: randomUUID(),
          inputRef: randomUUID(),
          browserSessionRef: "local",
          idempotencyKey: `post-comment-screenshot:${input.missionId}:${input.runId}:${input.roundId ?? ""}`,
        });
        if (postShot.status === "success") {
          if ("screenshotRef" in postShot && postShot.screenshotRef) {
            freshScreenshotRef = postShot.screenshotRef;
          }
        } else {
          shotFailed = true;
          shotFailureReason = ("failureReason" in postShot && postShot.failureReason)
            ? postShot.failureReason
            : "fresh viewport screenshot failed";
        }
      } catch (err) {
        shotFailed = true;
        shotFailureReason = err instanceof Error ? err.message : "post-comment screenshot threw";
      }
      // Screenshot failure must block SAVE — evidence without post-comment screenshot is incomplete
      if (shotFailed) {
        const failedState = getMissionState(input.missionId);
        const updated = applyStatusTransition(failedState, { status: "failed", failureReason: shotFailureReason ?? "post-comment screenshot failed before SAVE" });
        upsertMissionState(updated);
        return { status: "failed", stateSnapshot: updated, failureReason: shotFailureReason ?? "post-comment screenshot failed before SAVE", reviewRequiredReason: null };
      }
    }

    const { status, failureReason } = await dispatchSingleAction(action, input, ctx, { freshScreenshotRef, commentPanelOpenAttempted, actionIndex });

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

    const entry = findMuscleMemoryEntry(action.actionCode);
    const evidenceResult = await ctx.forensics.appendRecord({
      childCapabilityId: "append-record",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId ?? undefined,
      sourceCapabilityId: "orchestration",
      sourceChildCapabilityId: "dispatch-registered-ability-sequence",
      recordType: "ability_result",
      recordPayload: {
        actionCode: action.actionCode,
        reason: action.reason ?? (action.inputOverrides?.["reason"] as string | undefined) ?? null,
        gridCell: action.gridCell ?? (action.inputOverrides?.["gridCell"] as string | undefined) ?? null,
        cellZone: action.cellZone ?? (action.inputOverrides?.["cellZone"] as string | undefined) ?? null,
        abilityGroupId: entry ? entry.abilityGroupId : null,
        childCapabilityId: entry ? entry.childCapabilityId : null,
        status,
        failureReason: failureReason ?? null,
      },
      idempotencyKey: `orchestration:${input.missionId}:${input.runId}:${input.roundId ?? ""}:${actionIndex}:${action.actionCode}:${action.targetRole ?? "norole"}`,
    });
    if (evidenceResult.status !== "success") {
      const failedState = getMissionState(input.missionId);
      const reason = evidenceResult.failureReason ?? "Forensics appendRecord failed after action dispatch";
      const updated = applyStatusTransition(failedState, { status: "failed", failureReason: reason });
      upsertMissionState(updated);
      return { status: "failed", stateSnapshot: updated, failureReason: reason, reviewRequiredReason: null };
    }

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
    if (actionIndex < input.actions.length - 1) {
      ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "CAPABILITY_DISPATCH_COMPLETED",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        ...(input.roundId ? { roundId: input.roundId } : {}),
        status: "success",
        reason: `Inter-action settle wait durationMs=${INTER_ACTION_SETTLE_WAIT_MS}`,
      });
      await waitForInterActionSettle();
    }
  }

  return { status: "success", stateSnapshot: getMissionState(input.missionId), failureReason: null, reviewRequiredReason: null };
}
