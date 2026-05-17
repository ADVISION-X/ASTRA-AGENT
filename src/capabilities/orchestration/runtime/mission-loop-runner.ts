/**
 * mission-loop-runner.ts — Async round loop for a running mission.
 *
 * Called (fire-and-forget) from handleStartMission after the mission state
 * moves to "running".
 *
 * Each round:
 *   1. Check loop guard
 *   2. Capture browser viewport (screenshot)
 *   3. Render coordinate grid
 *   4. Call AI visual-mission-judge
 *   5. Parse pure visual round output
 *   6. Save current round evidence when requested by AI output
 *   7. Dispatch one next action via Nerve Bus
 *   7. Check loop guard after round
 *
 * The loop stops when the loop guard says so, the mission is paused/stopped,
 * or any step fails critically.
 */

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { OrchestrationChildrenContext } from "../children.js";
import { dispatchRegisteredAbilityAction } from "./dispatch-action.js";
import {
  getMissionState,
  upsertMissionState,
  applyMissionStatus,
  setActiveMission,
  now,
} from "./mission-state.js";
import { checkLoopGuardBeforeRound, checkLoopGuardAfterRound } from "./loop-guard.js";
import { loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog.js";
import {
  VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
  VISUAL_MISSION_DEFAULT_GRID_ROWS,
} from "../../screenshot/contract.js";

const VALID_PLATFORM_IDS = ["facebook-web", "tiktok-web"] as const;
type ValidPlatformId = (typeof VALID_PLATFORM_IDS)[number];
const INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS = 10_000;
const PRIMARY_AI_CONTEXT_MAX_WIDTH_PX = 896;
const PRESERVE_SCREENSHOT_ARTIFACTS_FOR_DEBUG = true;
const CELL_ZONE_REFERENCE_IMAGE_PATH = fileURLToPath(
  new URL("../../ai/assets/grid-cell-zone-reference.zh.png", import.meta.url),
);
type GridCellZone =
  | "top_left"
  | "top_center"
  | "top_right"
  | "middle_left"
  | "center"
  | "middle_right"
  | "bottom_left"
  | "bottom_center"
  | "bottom_right";

type ScreenshotCleanupKind =
  | "grid_failed"
  | "ai_failed"
  | "review_required"
  | "dispatch_failed"
  | "matched_evidence"
  | "no_match"
  | "done"
  | "blocked";

async function cleanupRoundScreenshotArtifacts(input: {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  cleanupKind: ScreenshotCleanupKind;
  originalScreenshotRef?: string | null;
  coordinateGridScreenshotRef?: string | null;
  extraTransientScreenshotRefs?: string[] | null;
  deleteOriginalScreenshot: boolean;
}) {
  const filesToDelete = [
    input.coordinateGridScreenshotRef,
    ...(input.extraTransientScreenshotRefs ?? []),
    ...(input.deleteOriginalScreenshot ? [input.originalScreenshotRef] : []),
  ].filter((file): file is string => typeof file === "string" && file.length > 0);

  const uniqueFiles = [...new Set(filesToDelete)];
  if (uniqueFiles.length === 0) return;

  if (PRESERVE_SCREENSHOT_ARTIFACTS_FOR_DEBUG) {
    input.ctx.runtimeLogger.emit({
      traceId: input.missionId,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      eventType: "SCREENSHOT_TRANSIENT_CLEANUP",
      owner: "orchestration",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId,
      status: "success",
      reason: `${input.cleanupKind}: debug preserve enabled; skipped deletion for ${uniqueFiles.length} transient file(s)`,
    });
    return;
  }

  const deleteResults = await Promise.allSettled(
    uniqueFiles.map(async (file) => {
      try {
        await unlink(file);
        return "deleted" as const;
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") return "already_missing" as const;
        throw error;
      }
    }),
  );

  let deletedOrMissing = 0;
  let failed = 0;
  for (const result of deleteResults) {
    if (result.status === "fulfilled") deletedOrMissing++;
    else failed++;
  }

  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "SCREENSHOT_TRANSIENT_CLEANUP",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: failed === 0 ? "success" : "failed",
    reason: `${input.cleanupKind}: deleted-or-missing ${deletedOrMissing} transient file(s)${
      failed > 0 ? `; ${failed} could not be deleted` : ""
    }`,
  });
}

async function systemSaveCurrentRoundEvidence(input: {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  userRequirementText: string;
  originalScreenshotRef: string;
  coordinateGridScreenshotRef: string;
  gridSpecRef: string;
  aiResultRef: string | null;
  saveReason: string;
  confidence: number;
  visualEvidence: string[];
}) {
  return input.ctx.forensics.appendRecord({
    childCapabilityId: "append-record",
    missionId: input.missionId,
    runId: input.runId,
    sessionId: "local",
    roundId: input.roundId,
    stepId: randomUUID(),
    capabilityCallId: randomUUID(),
    sourceCapabilityId: "orchestration",
    sourceChildCapabilityId: "mission-round-loop",
    recordType: "visual_evidence",
    recordPayload: {
      userRequirementText: input.userRequirementText,
      originalScreenshotRef: input.originalScreenshotRef,
      coordinateGridScreenshotRef: input.coordinateGridScreenshotRef,
      gridSpecRef: input.gridSpecRef,
      aiResultRef: input.aiResultRef,
      saveReason: input.saveReason,
      confidence: input.confidence,
      visualEvidence: input.visualEvidence,
    },
    artifactRefs: [
      input.originalScreenshotRef,
      input.coordinateGridScreenshotRef,
      input.gridSpecRef,
    ],
    parentRefs: input.aiResultRef ? [input.aiResultRef] : [],
    idempotencyKey: `pure-visual-round-save:${input.missionId}:${input.runId}:${input.roundId}`,
  });
}

function waitForInitialPlatformEntrySettle() {
  return new Promise<void>((resolve) => setTimeout(resolve, INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS));
}

function buildPrimaryAiContextPath(sourceFilePath: string, label: string): string {
  const ext = extname(sourceFilePath) || ".png";
  const base = basename(sourceFilePath, ext);
  return join(dirname(sourceFilePath), `${base}.${label}.ai.max${PRIMARY_AI_CONTEXT_MAX_WIDTH_PX}.png`);
}

async function resizePrimaryImageForAi(sourceFilePath: string, label: string): Promise<string> {
  const outputFilePath = buildPrimaryAiContextPath(sourceFilePath, label);
  await sharp(sourceFilePath)
    .resize({
      width: PRIMARY_AI_CONTEXT_MAX_WIDTH_PX,
      withoutEnlargement: true,
      fit: "inside",
    })
    .png({ compressionLevel: 9 })
    .toFile(outputFilePath);
  return outputFilePath;
}

export async function runMissionRoundLoop(
  missionId: string,
  ctx: OrchestrationChildrenContext,
): Promise<void> {
  const catalog = loadMuscleMemoryCatalog();

  while (true) {
    const state = getMissionState(missionId);

    // ── Loop guard (before round) ───────────────────────────────────────────
    const guardBefore = checkLoopGuardBeforeRound(state);
    if (guardBefore.shouldStop) {
      if (guardBefore.reason !== "mission-not-running") {
        const finalized = applyMissionStatus(state, {
          status: "completed",
          stopReason: guardBefore.reason,
          endedAt: now(),
        });
        upsertMissionState(finalized);
        setActiveMission(null);
        ctx.runtimeLogger.emit({
          traceId: missionId,
          level: "info",
          modeVisibility: ["FLOW", "DEBUG", "TRACE"],
          eventType: "MISSION_COMPLETED",
          owner: "orchestration",
          missionId,
          runId: state.activeRunId ?? state.runId ?? missionId,
          status: "success",
          reason: `Mission completed: ${guardBefore.reason}`,
        });
      }
      return;
    }

    const runId = state.activeRunId ?? state.runId;
    const roundId = randomUUID();
    const sessionId = "local";

    // Fail closed: missing or invalid platform must not fall back silently
    const requestedPlatform = state.requestedPlatform;
    if (requestedPlatform !== "facebook-web" && requestedPlatform !== "tiktok-web") {
      upsertMissionState(applyMissionStatus(state, {
        status: "failed",
        failureReason: `INVALID_PLATFORM: requestedPlatform=${requestedPlatform ?? "missing"}`,
      }));
      setActiveMission(null);
      return;
    }
    const platformId: ValidPlatformId = requestedPlatform;

    // Fail closed: missing humanGoal must not fall back to a default
    const userRequirementText = state.humanGoal;
    if (!userRequirementText) {
      upsertMissionState(applyMissionStatus(state, {
        status: "failed",
        failureReason: "MISSING_USER_REQUIREMENT: humanGoal is required",
      }));
      setActiveMission(null);
      return;
    }

    ctx.runtimeLogger.emit({
      traceId: missionId,
      level: "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: "ROUND_STARTED",
      owner: "orchestration",
      missionId,
      runId,
      roundId,
      status: "started",
      reason: `Round ${state.roundIndex ?? 0} started`,
    });

    // ── OPEN GATE: Navigate to platform entry on round 0 if targetProfileRef is set ──
    // Setup-step public-contract exception: Open / Screenshot / Grid / AI Judge setup
    // steps call the owning ability-group public contract directly (not through Nerve Bus).
    // Rationale: these are pre-round instrument steps, not external real actions dispatched
    // by the AI action plan. Every call includes capabilityCallId + nerveBusEnvelopeId for
    // proof continuity. The AI-selected external action must go through Nerve Bus.
    if ((state.roundIndex ?? 0) === 0 && state.targetUrl && !state.openResultRef) {
      const openCallId = randomUUID();
      const openResult = await ctx.openAbilityGroup.execute({
        childCapabilityId: "open-platform-entry-once",
        missionId,
        runId,
        sessionId,
        roundId,
        stepId: randomUUID(),
        capabilityCallId: openCallId,
        nerveBusEnvelopeId: openCallId,
        requestedBy: "orchestration:mission-loop",
        inputRef: randomUUID(),
        idempotencyKey: `open-entry:${missionId}:${runId}`,
        targetUrl: state.targetUrl,
        targetUrlSource: "platformRegistry",
        ...(state.targetProfileRef ? { targetProfileRef: state.targetProfileRef } : {}),
      });
      ctx.runtimeLogger.emit({
        traceId: missionId,
        level: openResult.status === "success" ? "info" : "warn",
        modeVisibility: ["FLOW", "DEBUG", "TRACE"],
        eventType: "OPEN_RESULT",
        owner: "orchestration",
        missionId,
        runId,
        roundId,
        status: openResult.status,
        reason: openResult.status === "success"
          ? `Opened targetUrl=${state.targetUrl}`
          : `OPEN FAILED targetUrl=${state.targetUrl}: ${openResult.failureReason ?? "unknown"}`,
      });
      if (openResult.status !== "success") {
        upsertMissionState(applyMissionStatus(getMissionState(missionId), {
          status: "failed",
          failureReason: openResult.failureReason ?? "Open gate failed",
        }));
        setActiveMission(null);
        return;
      }
      upsertMissionState({ ...getMissionState(missionId), openResultRef: openResult.openResultRef });
      ctx.runtimeLogger.emit({
        traceId: missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "OPEN_RESULT",
        owner: "orchestration",
        missionId,
        runId,
        roundId,
        status: "started",
        reason: `Initial platform entry settle wait started durationMs=${INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS}`,
      });
      await waitForInitialPlatformEntrySettle();
      ctx.runtimeLogger.emit({
        traceId: missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "OPEN_RESULT",
        owner: "orchestration",
        missionId,
        runId,
        roundId,
        status: "success",
        reason: `Initial platform entry settle wait completed durationMs=${INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS}`,
      });
    }

    // ── STEP 1: Capture browser viewport ───────────────────────────────────
    ctx.runtimeLogger.emit({
      traceId: missionId,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      eventType: "SCREENSHOT_CAPTURE_REQUESTED",
      owner: "orchestration",
      missionId,
      runId,
      roundId,
      status: "started",
      reason: `Round ${state.roundIndex ?? 0} capture-browser-viewport requested`,
    });
    let captureResult: Awaited<ReturnType<typeof ctx.screenshotAbilityGroup.execute>>;
    try {
      captureResult = await ctx.screenshotAbilityGroup.execute({
        childCapabilityId: "capture-browser-viewport",
        missionId,
        runId,
        sessionId,
        roundId,
        stepId: randomUUID(),
        capabilityCallId: randomUUID(),
        nerveBusEnvelopeId: randomUUID(),
        inputRef: randomUUID(),
        browserSessionRef: "local",
        idempotencyKey: `capture:${missionId}:${roundId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "screenshot capture threw";
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    if (captureResult.status !== "success" || !("screenshotRef" in captureResult) || !captureResult.screenshotRef) {
      const msg = ("failureReason" in captureResult ? captureResult.failureReason : null) ?? "screenshot capture failed";
      ctx.runtimeLogger.emit({ traceId: missionId, level: "error", modeVisibility: ["FLOW", "DEBUG", "TRACE"], eventType: "SCREENSHOT_CAPTURED", owner: "orchestration", missionId, runId, roundId, status: "failed", reason: msg });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    const originalScreenshotRef = captureResult.screenshotRef;
    ctx.runtimeLogger.emit({ traceId: missionId, level: "debug", modeVisibility: ["DEBUG", "TRACE"], eventType: "SCREENSHOT_CAPTURED", owner: "orchestration", missionId, runId, roundId, status: "success", reason: `screenshot ref=${originalScreenshotRef}` });
    const screenshotProofRef =
      "screenshotProof" in captureResult && captureResult.screenshotProof
        ? captureResult.screenshotProof.proofId
        : randomUUID();

    // ── STEP 2: Render coordinate grid ─────────────────────────────────────
    let gridResult: Awaited<ReturnType<typeof ctx.screenshotAbilityGroup.execute>>;
    try {
      gridResult = await ctx.screenshotAbilityGroup.execute({
        childCapabilityId: "render-coordinate-grid",
        missionId,
        runId,
        sessionId,
        roundId,
        stepId: randomUUID(),
        capabilityCallId: randomUUID(),
        nerveBusEnvelopeId: randomUUID(),
        inputRef: randomUUID(),
        sourceScreenshotRef: originalScreenshotRef,
        sourceScreenshotProofRef: screenshotProofRef,
        gridPolicy: {
          rowCount: VISUAL_MISSION_DEFAULT_GRID_ROWS,
          columnCount: VISUAL_MISSION_DEFAULT_GRID_COLUMNS,
        },
        idempotencyKey: `grid:${missionId}:${roundId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "grid render threw";
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "grid_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef: null,
        extraTransientScreenshotRefs: [],
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    if (
      gridResult.status !== "success" ||
      !("coordinateGridScreenshotRef" in gridResult) ||
      !gridResult.coordinateGridScreenshotRef ||
      !("gridSpecRef" in gridResult) ||
      !gridResult.gridSpecRef
    ) {
      const msg = ("failureReason" in gridResult ? gridResult.failureReason : null) ?? "grid render failed";
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "grid_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef: "coordinateGridScreenshotRef" in gridResult
          ? (gridResult.coordinateGridScreenshotRef ?? null)
          : null,
        extraTransientScreenshotRefs: [],
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    const coordinateGridScreenshotRef = gridResult.coordinateGridScreenshotRef;
    const gridSpecRef = gridResult.gridSpecRef;
    ctx.runtimeLogger.emit({
      traceId: missionId,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      eventType: "COORDINATE_GRID_RENDERED",
      owner: "orchestration",
      missionId,
      runId,
      roundId,
      status: "success",
      reason: `grid rendered ref=${coordinateGridScreenshotRef}`,
    });
    // Resolve AI-readable file paths (prefer explicit aiReadableImagePath field)
    const originalAiPath =
      "aiReadableImagePath" in captureResult && captureResult.aiReadableImagePath
        ? captureResult.aiReadableImagePath
        : originalScreenshotRef;
    const gridAiPath =
      "aiReadableImagePath" in gridResult && gridResult.aiReadableImagePath
        ? gridResult.aiReadableImagePath
        : coordinateGridScreenshotRef;

    let primaryAiContextImageRefs: string[] = [];
    try {
      primaryAiContextImageRefs = [
        await resizePrimaryImageForAi(originalAiPath, "original"),
        await resizePrimaryImageForAi(gridAiPath, "grid"),
      ];
      ctx.runtimeLogger.emit({
        traceId: missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "SCREENSHOT_CAPTURED",
        owner: "orchestration",
        missionId,
        runId,
        roundId,
        status: "success",
        reason: `Primary AI context images prepared maxWidth=${PRIMARY_AI_CONTEXT_MAX_WIDTH_PX} refs=${primaryAiContextImageRefs.join(";")}`,
      });
    } catch (error) {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "ai_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: [],
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "failed",
        failureReason: `AI context image resize failed: ${error instanceof Error ? error.message : "unknown error"}`,
      }));
      setActiveMission(null);
      return;
    }
    const aiTransientScreenshotRefs = primaryAiContextImageRefs;

    // ── STEP 3: Call AI visual-mission-judge ───────────────────────────────

    let aiResult: Awaited<ReturnType<typeof ctx.aiAbilityGroup.execute>>;
    try {
      aiResult = await ctx.aiAbilityGroup.execute({
        abilityGroupId: "ai",
        missionId,
        runId,
        sessionId,
        roundId,
        videoVisitId: null,
        capabilityCallId: randomUUID(),
        nerveBusEnvelopeId: randomUUID(),
        requestedBy: "orchestration",
        transportedBy: "nerve-bus",
        taskType: "visual_mission_judgment",
        promptContractId: "visual-mission-judge-v1",
        expectedOutputSchema: "ai.visual_mission_judgment.v1",
        inputRefs: [
          {
            id: originalScreenshotRef,
            kind: "screenshot",
            summary: `original current viewport screenshot, resized for AI maxWidth=${PRIMARY_AI_CONTEXT_MAX_WIDTH_PX}`,
            filePath: primaryAiContextImageRefs[0],
          },
          {
            id: coordinateGridScreenshotRef,
            kind: "coordinate-grid-screenshot",
            summary: `coordinate grid overlay, resized for AI maxWidth=${PRIMARY_AI_CONTEXT_MAX_WIDTH_PX}`,
            filePath: primaryAiContextImageRefs[1],
          },
          {
            id: "grasseye-fixed-cell-zone-reference-v1",
            kind: "cell-zone-reference",
            summary: "fixed 3x3 cellZone reference diagram; use only to understand top_left/top_center/top_right/middle_left/center/middle_right/bottom_left/bottom_center/bottom_right",
            filePath: CELL_ZONE_REFERENCE_IMAGE_PATH,
          },
        ],
        userRequirementRef: null,
        userRequirementText,
        platformId,
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        gridSpecRef,
        systemManualRef: "system.v1",
        muscleMemoryCatalogVersion: catalog.catalogVersion,
        continuityBundleRef: null,
        input: {
          userRequirementRef: null,
          userRequirementText,
          systemManualRef: "system.v1",
          outputSchemaRef: "ai.visual_mission_judgment.v1" as const,
          originalScreenshotRef,
          coordinateGridScreenshotRef,
          gridSpecRef,
          platformContextRef: platformId,
          platformContext: {
            platformId,
            targetUrl: state.targetUrl ?? null,
            targetTitle: state.targetTitle ?? null,
            targetProfileRef: state.targetProfileRef ?? null,
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI call threw";
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "ai_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    if (aiResult.status === "review_required") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "review_required",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiResult.reviewRequiredReason ?? "AI requested review",
      }));
      return;
    }

    if (aiResult.status !== "success" || !aiResult.output) {
      const msg = aiResult.failureReason ?? "AI returned no output";
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "ai_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    // ── STEP 4: Save if matched, then dispatch one AI-selected next action ──
    const aiOutput = aiResult.output;
    const aiResultRef = aiResult.runtimeProof?.proofId ?? null;

    ctx.runtimeLogger.emit({
      traceId: missionId,
      level: "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: "AI_DECISION_SUMMARY",
      owner: "orchestration",
      missionId,
      runId,
      roundId,
      status: "success",
      reason: `goalMatched=${aiOutput.goalMatched} save=${aiOutput.save} decision=${aiOutput.decision} nextAction=${aiOutput.nextAction?.actionCode ?? "none"}`,
      metrics: { actionCount: aiOutput.nextAction ? 1 : 0 },
    });

    let evidenceSaved = false;
    if (aiOutput.save) {
      const saveResult = await systemSaveCurrentRoundEvidence({
        ctx,
        missionId,
        runId,
        roundId,
        userRequirementText,
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        gridSpecRef,
        aiResultRef,
        saveReason: aiOutput.saveReason,
        confidence: aiOutput.confidence,
        visualEvidence: aiOutput.visualEvidence,
      });

      if (saveResult.status !== "success") {
        const msg = saveResult.failureReason ?? "system evidence save failed";
        await cleanupRoundScreenshotArtifacts({
          ctx,
          missionId,
          runId,
          roundId,
          cleanupKind: "dispatch_failed",
          originalScreenshotRef,
          coordinateGridScreenshotRef,
          extraTransientScreenshotRefs: aiTransientScreenshotRefs,
          deleteOriginalScreenshot: true,
        });
        upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: msg }));
        setActiveMission(null);
        return;
      }

      evidenceSaved = true;
      upsertMissionState({
        ...getMissionState(missionId),
        matchedEvidenceCount: (getMissionState(missionId).matchedEvidenceCount ?? 0) + 1,
      });
      ctx.runtimeLogger.emit({
        traceId: missionId,
        level: "info",
        modeVisibility: ["FLOW", "DEBUG", "TRACE"],
        eventType: "FORENSICS_RECORD_APPENDED",
        owner: "orchestration",
        missionId,
        runId,
        roundId,
        status: "success",
        reason: `system saved current round evidence ref=${saveResult.recordRef ?? "unknown"}`,
      });
    }

    if (aiOutput.decision === "done") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "done",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !evidenceSaved,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "completed",
        stopReason: aiOutput.doneReason ?? "AI marked mission done",
        endedAt: now(),
      }));
      setActiveMission(null);
      return;
    }

    if (aiOutput.decision === "review_required") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "review_required",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !evidenceSaved,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiOutput.reviewRequiredReason ?? "AI requested review",
      }));
      return;
    }

    if (aiOutput.decision === "blocked") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "blocked",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !evidenceSaved,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiOutput.reviewRequiredReason ?? "AI blocked the mission",
      }));
      return;
    }

    const nextAction = aiOutput.nextAction;
    if (!nextAction) {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "dispatch_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !evidenceSaved,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "failed",
        failureReason: "AI decision act did not include nextAction",
      }));
      setActiveMission(null);
      return;
    }

    const actionInput = { ...(nextAction.input ?? {}) };
    const entry = catalog.entries.find(e => e.actionCode === nextAction.actionCode);
    const dispatchAction = {
      actionCode: nextAction.actionCode,
      reason: nextAction.reason ?? null,
      input: {
        ...actionInput,
        ...(entry?.requiresGridSpecRef ? { gridSpecRef } : {}),
      },
      required: true,
      gridCell: nextAction.gridCell ?? (actionInput["gridCell"] as string | undefined) ?? null,
      cellZone: nextAction.cellZone ?? (actionInput["cellZone"] as GridCellZone | undefined) ?? null,
    };

    const actionResult = await dispatchRegisteredAbilityAction(
      {
        missionId,
        runId,
        roundId,
        aiResultRef,
        action: dispatchAction,
        currentEvidenceRefs: {
          originalScreenshotRef,
          coordinateGridScreenshotRef,
          gridSpecRef,
        },
      },
      {
        nerveBus: ctx.nerveBus,
        forensics: ctx.forensics,
        geometryGuard: ctx.geometryGuard,
        screenshotAbilityGroup: ctx.screenshotAbilityGroup,
        runtimeLogger: ctx.runtimeLogger,
      },
    );

    if (actionResult.status !== "success") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "dispatch_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !evidenceSaved,
      });
      const stateAfterDispatch = getMissionState(missionId);
      upsertMissionState({
        ...stateAfterDispatch,
        lastActionStatus: actionResult.status,
        lastFailureReason: actionResult.failureReason ?? null,
        lastReviewRequiredReason: actionResult.reviewRequiredReason ?? null,
      });
      if (stateAfterDispatch.status !== "running") return;
      if (actionResult.status === "failed") {
        upsertMissionState(applyMissionStatus(getMissionState(missionId), {
          status: "failed",
          failureReason: actionResult.failureReason ?? "action dispatch failed",
        }));
        setActiveMission(null);
        return;
      }
      return;
    }

    const stateAfterSuccess = getMissionState(missionId);
    upsertMissionState({ ...stateAfterSuccess, lastActionStatus: "success", lastFailureReason: null });

    // ── Transient screenshot cleanup (every round) ──────────────────────────
    // coordinateGridScreenshotRef is ALWAYS a processing artifact — only used as AI input.
    await cleanupRoundScreenshotArtifacts({
      ctx,
      missionId,
      runId,
      roundId,
      cleanupKind: evidenceSaved ? "matched_evidence" : "no_match",
      originalScreenshotRef,
      coordinateGridScreenshotRef,
      extraTransientScreenshotRefs: aiTransientScreenshotRefs,
      deleteOriginalScreenshot: !evidenceSaved,
    });

    // ── Loop guard (after round) ────────────────────────────────────────────
    const stateAfter = getMissionState(missionId);
    const guardAfter = checkLoopGuardAfterRound(stateAfter);
    if (guardAfter.shouldStop) {
      if (guardAfter.reason !== "mission-not-running") {
        const finalized = applyMissionStatus(stateAfter, {
          status: "completed",
          stopReason: guardAfter.reason,
          endedAt: now(),
        });
        upsertMissionState(finalized);
        setActiveMission(null);
        ctx.runtimeLogger.emit({
          traceId: missionId,
          level: "info",
          modeVisibility: ["FLOW", "DEBUG", "TRACE"],
          eventType: "MISSION_COMPLETED",
          owner: "orchestration",
          missionId,
          runId,
          status: "success",
          reason: `Mission completed: ${guardAfter.reason}`,
        });
      }
      return;
    }

    // Increment roundIndex so subsequent rounds have correct context
    upsertMissionState({
      ...getMissionState(missionId),
      roundIndex: (getMissionState(missionId).roundIndex ?? 0) + 1,
    });

    ctx.runtimeLogger.emit({
      traceId: missionId,
      level: "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: "ROUND_COMPLETED",
      owner: "orchestration",
      missionId,
      runId,
      roundId,
      status: "success",
      reason: `Round completed`,
    });

    // Wait for Facebook Reels to finish loading the next video before the next screenshot.
    // 500ms was too short; Reels needs about 2s to load video after a blank frame.
    await new Promise<void>(r => setTimeout(r, 2500));
  }
}
