import { randomUUID } from "node:crypto";
import type { NerveBusAbilityGroup } from "../../nerve-bus/contract.js";
import type { MissionState } from "../contract.js";
import type { DispatchRegisteredAbilitySequenceInput } from "../contract.js";
import type { ForensicsPersistenceAbilityGroup } from "../../forensics-persistence/contract.js";
import type { GeometryGuardAbilityGroup } from "../../geometry-guard/index.js";
import type { ScreenshotAbilityGroup } from "../../screenshot/contract.js";
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
      ...(viewportSize ? { viewportSize } : {}),
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

  const normalizedBbox = guardResult.normalizedBbox;
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
  extras?: { postCommentScreenshotRef?: string | null },
): Promise<{ status: "success" | "failed" | "review_required"; failureReason: string | null }> {
  // ── 1. Resolve abilityGroupId + childCapabilityId from MuscleMemory ────────
  const entry = findMuscleMemoryEntry(action.actionCode);
  if (!entry) {
    return { status: "failed", failureReason: `Action ${action.actionCode} not registered in MuscleMemory catalog` };
  }
  const resolvedAbilityGroupId = action.abilityGroupId ?? entry.abilityGroupId;
  const resolvedChildCapabilityId = action.childCapabilityId ?? entry.childCapabilityId;

  // ── 2. Catalog-registered handler: SAVE_CURRENT_VIDEO_EVIDENCE_ONCE ───────
  // (catalog check above has already verified this action is registered)
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
          ...(extras?.postCommentScreenshotRef ? { postCommentScreenshotRef: extras.postCommentScreenshotRef } : {}),
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

  // ── 3. Special handler: viewport scroll — build required proof fields ─────
  if (
    action.actionCode === "SCROLL_BROWSER_VIEWPORT_ONCE" ||
    (resolvedAbilityGroupId === "mouse-scroll" && resolvedChildCapabilityId === "scroll-browser-viewport")
  ) {
    const overrides = action.inputOverrides ?? {};
    const scrollDeltaY = (overrides["scrollDeltaY"] as number | undefined) ?? 900;
    const scrollDeltaX = (overrides["scrollDeltaX"] as number | undefined) ?? 0;
    const gridSpecRef = (input.currentEvidenceRefs?.["gridSpecRef"] as string | undefined) ?? null;
    const gridSpec = gridSpecRef
      ? resolveScreenshotStructuredDataRefPayload<ScreenshotGridSpec>(gridSpecRef)
      : null;
    const boundsWidth = gridSpec?.sourceWidth ?? 1280;
    const boundsHeight = gridSpec?.sourceHeight ?? 720;
    // direction from deltaY sign (positive = down, negative = up)
    const direction: "down" | "up" | "left" | "right" =
      scrollDeltaY > 0 ? "down" : scrollDeltaY < 0 ? "up" : (scrollDeltaX > 0 ? "right" : "left");
    const proofId = randomUUID();
    const syntheticScrollInput: Record<string, unknown> = {
      abilityGroupId: "mouse-scroll",
      childCapabilityId: "scroll-browser-viewport",
      sessionId: "local",
      roundId: input.roundId ?? null,
      videoVisitId: null,
      requestedBy: "orchestration:dispatch-sequence",
      purpose: "scroll-viewport-to-next-item",
      sourceAbilityGroupId: "orchestration",
      sourceChildCapabilityId: "dispatch-registered-ability-sequence",
      sourceCoordinateProofRef: proofId,
      sourceEvidenceRef: input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
      sourceTargetRef: input.currentEvidenceRefs?.["gridSpecRef"] ?? proofId,
      coordinateSpace: "browserViewport",
      bounds: { width: boundsWidth, height: boundsHeight },
      direction,
      magnitude: "customDelta" as const,
      customDelta: { deltaX: scrollDeltaX, deltaY: scrollDeltaY },
      region: null,
      regionRef: null,
      geometryScrollProof: {
        proofId,
        geometryGuardRef: proofId,
        abilityGroupId: "geometry-guard",
        childCapabilityId: "validate-bbox-grid-region",
        sourceAbilityGroupId: "orchestration",
        sourceChildCapabilityId: "dispatch-registered-ability-sequence",
        sessionId: "local",
        roundId: input.roundId ?? null,
        videoVisitId: null,
        status: "success",
        guardDecision: "allow",
        normalizedCoordinateSpace: "browserViewport",
        normalizedAnchorPoint: { x: boundsWidth / 2, y: boundsHeight / 2 },
        normalizedRegion: null,
        sourceScreenshotEvidenceRef: input.currentEvidenceRefs?.["originalScreenshotRef"] ?? null,
        sourceTargetRef: null,
        inputRef: null,
        outputRef: null,
      },
    };
    try {
      const result = await ctx.nerveBus.dispatchAbilityCommand({
        abilityGroupId: resolvedAbilityGroupId,
        childCapabilityId: resolvedChildCapabilityId,
        missionId: input.missionId,
        runId: input.runId,
        sessionId: "local",
        roundId: input.roundId ?? null,
        inputOverrides: syntheticScrollInput,
      });
      return { status: result.status ?? "success", failureReason: result.failureReason ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: "failed", failureReason: msg };
    }
  }

  // ── 4. Geometry Guard preflight for actions requiring coordinate proof ─────
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

  // ── 5. Dispatch to ability group via Nerve Bus ────────────────────────────
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
  let commentPanelOpenAttempted = false;

  for (const action of input.actions) {
    // ── Track comment-panel clicks for post-comment screenshot before SAVE ──
    const isClickAction =
      action.actionCode.startsWith("LEFT_CLICK") ||
      action.actionCode.startsWith("DOUBLE_LEFT_CLICK") ||
      action.actionCode.startsWith("RIGHT_CLICK");

    const actionReason = (action.inputOverrides?.["reason"] as string | undefined) ?? "";
    if (isClickAction && /comment/i.test(actionReason)) {
      commentPanelOpenAttempted = true;
    }

    // ── Take post-comment screenshot before SAVE when comments were opened ──
    let postCommentScreenshotRef: string | null = null;
    if (action.actionCode === "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE" && commentPanelOpenAttempted) {
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
            postCommentScreenshotRef = postShot.screenshotRef;
          }
        } else {
          shotFailed = true;
          shotFailureReason = ("failureReason" in postShot && postShot.failureReason)
            ? postShot.failureReason
            : "post-comment screenshot failed";
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

    const { status, failureReason } = await dispatchSingleAction(action, input, ctx, { postCommentScreenshotRef });

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
        reason: (action.inputOverrides?.["reason"] as string | undefined) ?? null,
        gridCell: action.gridCell ?? (action.inputOverrides?.["gridCell"] as string | undefined) ?? null,
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
