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
 *   5. Decode AI output → action sequence
 *   6. Dispatch action sequence via Nerve Bus (dispatch-registered-ability-sequence)
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
import { dispatchRegisteredAbilitySequence } from "./dispatch-sequence.js";
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
const TEMPORAL_CONTEXT_FRAME_COUNT = 2;
const TEMPORAL_CONTEXT_FRAME_INTERVAL_MS = 2_000;
const TEMPORAL_CONTEXT_MAX_WIDTH_PX = 512;
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
  | "product_yes"
  | "product_no"
  | "uncertain";

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

function resolveSelectedPlatforms(
  platforms: string[],
  requestedPlatform: ValidPlatformId,
): [ValidPlatformId, ...ValidPlatformId[]] {
  const valid = platforms.filter((p): p is ValidPlatformId =>
    p === "facebook-web" || p === "tiktok-web",
  );
  if (valid.length === 0) return [requestedPlatform];
  return valid as [ValidPlatformId, ...ValidPlatformId[]];
}

function waitForInitialPlatformEntrySettle() {
  return new Promise<void>((resolve) => setTimeout(resolve, INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS));
}

function waitForTemporalContextFrameInterval() {
  return new Promise<void>((resolve) => setTimeout(resolve, TEMPORAL_CONTEXT_FRAME_INTERVAL_MS));
}

function buildTemporalContextSmallPath(sourceFilePath: string, frameIndex: number): string {
  const ext = extname(sourceFilePath) || ".png";
  const base = basename(sourceFilePath, ext);
  return join(dirname(sourceFilePath), `${base}.temporal-${frameIndex + 1}.max${TEMPORAL_CONTEXT_MAX_WIDTH_PX}.png`);
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

async function resizeTemporalContextFrameForAi(sourceFilePath: string, frameIndex: number): Promise<string> {
  const outputFilePath = buildTemporalContextSmallPath(sourceFilePath, frameIndex);
  await sharp(sourceFilePath)
    .resize({
      width: TEMPORAL_CONTEXT_MAX_WIDTH_PX,
      withoutEnlargement: true,
      fit: "inside",
    })
    .png({ compressionLevel: 9 })
    .toFile(outputFilePath);
  return outputFilePath;
}

async function captureTemporalContextFrames(input: {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
}): Promise<string[]> {
  const smallFrameRefs: string[] = [];

  for (let frameIndex = 0; frameIndex < TEMPORAL_CONTEXT_FRAME_COUNT; frameIndex += 1) {
    await waitForTemporalContextFrameInterval();

    input.ctx.runtimeLogger.emit({
      traceId: input.missionId,
      level: "debug",
      modeVisibility: ["DEBUG", "TRACE"],
      eventType: "SCREENSHOT_CAPTURE_REQUESTED",
      owner: "orchestration",
      missionId: input.missionId,
      runId: input.runId,
      roundId: input.roundId,
      status: "started",
      reason: `Temporal context frame ${frameIndex + 1}/${TEMPORAL_CONTEXT_FRAME_COUNT} requested intervalMs=${TEMPORAL_CONTEXT_FRAME_INTERVAL_MS} maxWidth=${TEMPORAL_CONTEXT_MAX_WIDTH_PX}`,
    });

    try {
      const temporalCapture = await input.ctx.screenshotAbilityGroup.execute({
        childCapabilityId: "capture-browser-viewport",
        missionId: input.missionId,
        runId: input.runId,
        sessionId: input.sessionId,
        roundId: input.roundId,
        stepId: randomUUID(),
        capabilityCallId: randomUUID(),
        nerveBusEnvelopeId: randomUUID(),
        inputRef: randomUUID(),
        browserSessionRef: "local",
        idempotencyKey: `temporal-context-capture:${input.missionId}:${input.roundId}:${frameIndex}`,
      });

      if (
        temporalCapture.status !== "success" ||
        !("screenshotRef" in temporalCapture) ||
        !temporalCapture.screenshotRef
      ) {
        const reason = ("failureReason" in temporalCapture ? temporalCapture.failureReason : null)
          ?? "temporal context screenshot failed";
        input.ctx.runtimeLogger.emit({
          traceId: input.missionId,
          level: "warn",
          modeVisibility: ["DEBUG", "TRACE"],
          eventType: "SCREENSHOT_CAPTURED",
          owner: "orchestration",
          missionId: input.missionId,
          runId: input.runId,
          roundId: input.roundId,
          status: "failed",
          reason: `Temporal context frame ${frameIndex + 1} skipped: ${reason}`,
        });
        continue;
      }

      const smallFrameRef = await resizeTemporalContextFrameForAi(
        temporalCapture.screenshotRef,
        frameIndex,
      );
      smallFrameRefs.push(smallFrameRef);
      if (!PRESERVE_SCREENSHOT_ARTIFACTS_FOR_DEBUG) {
        await unlink(temporalCapture.screenshotRef).catch(() => undefined);
      }

      input.ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: "debug",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "SCREENSHOT_CAPTURED",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        roundId: input.roundId,
        status: "success",
        reason: `Temporal context frame ${frameIndex + 1} captured ref=${smallFrameRef} maxWidth=${TEMPORAL_CONTEXT_MAX_WIDTH_PX}`,
      });
    } catch (error) {
      input.ctx.runtimeLogger.emit({
        traceId: input.missionId,
        level: "warn",
        modeVisibility: ["DEBUG", "TRACE"],
        eventType: "SCREENSHOT_CAPTURED",
        owner: "orchestration",
        missionId: input.missionId,
        runId: input.runId,
        roundId: input.roundId,
        status: "failed",
        reason: `Temporal context frame ${frameIndex + 1} skipped: ${error instanceof Error ? error.message : "unknown error"}`,
      });
    }
  }

  return smallFrameRefs;
}

export async function runMissionRoundLoop(
  missionId: string,
  ctx: OrchestrationChildrenContext,
): Promise<void> {
  const catalog = loadMuscleMemoryCatalog();
  let previousRoundId: string | null = null;

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
    const selectedPlatforms = resolveSelectedPlatforms(state.selectedPlatforms ?? [], platformId);

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
    // proof continuity. Real external action sequences (AI output) must go through Nerve Bus.
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

    const temporalContextScreenshotRefs = await captureTemporalContextFrames({
      ctx,
      missionId,
      runId,
      sessionId,
      roundId,
    });

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
        extraTransientScreenshotRefs: temporalContextScreenshotRefs,
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
        extraTransientScreenshotRefs: temporalContextScreenshotRefs,
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
        extraTransientScreenshotRefs: temporalContextScreenshotRefs,
        deleteOriginalScreenshot: true,
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "failed",
        failureReason: `AI context image resize failed: ${error instanceof Error ? error.message : "unknown error"}`,
      }));
      setActiveMission(null);
      return;
    }
    const aiTransientScreenshotRefs = [
      ...temporalContextScreenshotRefs,
      ...primaryAiContextImageRefs,
    ];

    // ── STEP 3: Call AI visual-mission-judge ───────────────────────────────
    const roundMissionPacket = {
      schemaVersion: "roundMissionPacket.v1" as const,
      mission: {
        missionId,
        userRequirementRef: null,
        userRequirementText,
        requestedPlatformId: platformId,
        selectedPlatforms,
        maxRounds: state.maxRounds ?? null,
        maxMinutes: state.maxMinutes ?? null,
      },
      round: {
        roundId,
        roundIndex: state.roundIndex ?? 0,
        previousRoundId,
        currentPhase: null,
      },
      progress: {
        savedLeadCount: state.savedEvidenceCount ?? 0,
        skippedCount: state.skippedVideoCount ?? 0,
        reviewRequiredCount: state.reviewRequiredCount ?? 0,
        failedActionCount: state.failedActionCount ?? 0,
        consecutiveFailureCount: state.consecutiveFailureCount ?? 0,
      },
      lastAction: {
        sourceActionCode: null,
        status: "pending" as const,
        failureReason: null,
        outputRef: null,
        gridCell: null,
        targetName: null,
        summary: null,
        actionInputRef: null,
        completedAt: null,
      },
      currentEvidence: {
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        gridSpecRef,
        visualMissionInputRef: null,
        aiResultRef: null,
      },
      platformContext: {
        platformContextRef: null,
        platformId,
        targetUrl: state.targetUrl ?? null,
        targetTitle: state.targetTitle ?? null,
        targetProfileRef: state.targetProfileRef ?? null,
      },
      constraints: {
        noHumanInLoop: true as const,
        requireCoordinateGridForVisualActions: true as const,
        noRawCoordinates: true as const,
        stopWhenBlocked: true as const,
        stopWhenUnsafe: true as const,
      },
      allowedActions: {
        systemManualRef: "system.v1",
        catalogVersion: catalog.catalogVersion,
      },
    };

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
          ...temporalContextScreenshotRefs.map((filePath, index) => ({
            id: filePath,
            kind: "temporal-context-screenshot",
            summary: `small temporal context screenshot ${index + 1}/${temporalContextScreenshotRefs.length}, maxWidth=${TEMPORAL_CONTEXT_MAX_WIDTH_PX}`,
            filePath,
          })),
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
          roundMissionPacketRef: null,
          roundMissionPacket,
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

    // ── STEP 4: Dispatch AI-driven action sequence ─────────────────────────
    const aiOutput = aiResult.output;

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
      reason: `productDecision=${aiOutput.productDecision} pageState=${aiOutput.pageStateDecision} actions=${aiOutput.actions?.length ?? 0}`,
      metrics: { actionCount: aiOutput.actions?.length ?? 0 },
    });

    // Hard-stop if AI decided review is required
    if (aiOutput.pageStateDecision === "review_required") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "review_required",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: aiOutput.productDecision !== "product_yes",
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiOutput.reason ?? "AI: page state requires review",
      }));
      return;
    }

    const dispatchActions = aiOutput.actions
      .filter(a => a.actionCode !== "STOP_REVIEW_REQUIRED_ONCE")
      .map(action => {
        const actionInput = { ...(action.input ?? {}) };
        const entry = catalog.entries.find(e => e.actionCode === action.actionCode);
        return {
          actionCode: action.actionCode,
          reason: action.reason ?? null,
          input: {
            ...actionInput,
            ...(entry?.requiresGridSpecRef ? { gridSpecRef } : {}),
          },
          required: action.required ?? true,
          gridCell: action.gridCell ?? (actionInput["gridCell"] as string | undefined) ?? null,
          cellZone: action.cellZone ?? (actionInput["cellZone"] as GridCellZone | undefined) ?? null,
        };
      });
    const hasSaveRecordAction = dispatchActions.some((action) => action.actionCode === "SAVE_RECORD_ONCE");

    // Check for explicit STOP_REVIEW_REQUIRED_ONCE in AI actions
    const stopAction = aiOutput.actions.find(a => a.actionCode === "STOP_REVIEW_REQUIRED_ONCE");
    if (stopAction) {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "review_required",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: aiOutput.productDecision !== "product_yes",
      });
      upsertMissionState(applyMissionStatus(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: stopAction.reason ?? "AI action: STOP_REVIEW_REQUIRED_ONCE",
      }));
      return;
    }

    const sequenceResult = await dispatchRegisteredAbilitySequence(
      {
        missionId,
        runId,
        roundId,
        aiResultRef: aiResult.runtimeProof?.proofId ?? null,
        actions: dispatchActions,
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

    if (sequenceResult.status !== "success") {
      await cleanupRoundScreenshotArtifacts({
        ctx,
        missionId,
        runId,
        roundId,
        cleanupKind: "dispatch_failed",
        originalScreenshotRef,
        coordinateGridScreenshotRef,
        extraTransientScreenshotRefs: aiTransientScreenshotRefs,
        deleteOriginalScreenshot: !hasSaveRecordAction,
      });
      // Mission state may have been updated inside dispatch-sequence — check and stop if needed
      const stateAfterDispatch = getMissionState(missionId);
      // Update failure counters
      if (sequenceResult.status === "review_required") {
        upsertMissionState({
          ...stateAfterDispatch,
          reviewRequiredCount: (stateAfterDispatch.reviewRequiredCount ?? 0) + 1,
          consecutiveFailureCount: (stateAfterDispatch.consecutiveFailureCount ?? 0) + 1,
        });
      } else {
        upsertMissionState({
          ...stateAfterDispatch,
          failedActionCount: (stateAfterDispatch.failedActionCount ?? 0) + 1,
          consecutiveFailureCount: (stateAfterDispatch.consecutiveFailureCount ?? 0) + 1,
        });
      }
      if (stateAfterDispatch.status !== "running") return;
      // If still "running" but dispatch failed, stop gracefully
      if (sequenceResult.status === "failed") {
        upsertMissionState(applyMissionStatus(getMissionState(missionId), {
          status: "failed",
          failureReason: sequenceResult.failureReason ?? "action sequence dispatch failed",
        }));
        setActiveMission(null);
        return;
      }
      return; // review_required or other terminal state
    }

    // ── Update progress counters based on AI decision ───────────────────────
    const stateAfterSuccess = getMissionState(missionId);
    const productDecision = aiOutput.productDecision;
    // Only an AI-selected save action makes the original screenshot evidence.
    const deleteOriginalScreenshot = !hasSaveRecordAction;
    if (hasSaveRecordAction) {
      upsertMissionState({
        ...stateAfterSuccess,
        savedEvidenceCount: (stateAfterSuccess.savedEvidenceCount ?? 0) + 1,
        consecutiveFailureCount: 0,
      });
    } else if (productDecision === "product_no") {
      upsertMissionState({
        ...stateAfterSuccess,
        skippedVideoCount: (stateAfterSuccess.skippedVideoCount ?? 0) + 1,
        consecutiveFailureCount: 0,
      });
    } else {
      upsertMissionState({ ...stateAfterSuccess, consecutiveFailureCount: 0 });
    }

    // ── Transient screenshot cleanup (every round) ──────────────────────────
    // coordinateGridScreenshotRef is ALWAYS a processing artifact — only used as AI input.
    // The SAVE handler only stores its path string; the file bytes are not needed after this point.
    // originalScreenshotRef is kept for product_yes (it is permanent evidence); deleted for product_no.
    await cleanupRoundScreenshotArtifacts({
      ctx,
      missionId,
      runId,
      roundId,
      cleanupKind: productDecision,
      originalScreenshotRef,
      coordinateGridScreenshotRef,
      extraTransientScreenshotRefs: aiTransientScreenshotRefs,
      deleteOriginalScreenshot,
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

    previousRoundId = roundId;

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
