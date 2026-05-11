/**
 * mission-loop-runner.ts — Async round loop for a running mission.
 *
 * Called (fire-and-forget) from handleStartMission after the mission state
 * transitions to "running".
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
import type { OrchestrationChildrenContext } from "../children.js";
import { dispatchRegisteredAbilitySequence } from "./dispatch-sequence.js";
import {
  getMissionState,
  upsertMissionState,
  applyStatusTransition,
  setActiveMission,
  now,
} from "./mission-state.js";
import { checkLoopGuardBeforeRound, checkLoopGuardAfterRound } from "./loop-guard.js";
import { loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog.js";

const VALID_PLATFORM_IDS = ["facebook-web", "tiktok-web"] as const;
type ValidPlatformId = (typeof VALID_PLATFORM_IDS)[number];

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
        const finalized = applyStatusTransition(state, {
          status: "completed",
          stopReason: guardBefore.reason,
          endedAt: now(),
        });
        upsertMissionState(finalized);
        setActiveMission(null);
      }
      return;
    }

    const runId = state.activeRunId ?? state.runId;
    const roundId = randomUUID();
    const sessionId = "local";

    // Fail closed: missing or invalid platform must not fall back silently
    const requestedPlatform = state.requestedPlatform;
    if (requestedPlatform !== "facebook-web" && requestedPlatform !== "tiktok-web") {
      upsertMissionState(applyStatusTransition(state, {
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
      upsertMissionState(applyStatusTransition(state, {
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
    // Direct call (not through Nerve Bus) — Open returns its own openResultRef and
    // Nerve Bus is pure transport; this avoids unnecessary envelope wrapping for the
    // initial platform navigation which precedes all ability-group rounds.
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
        upsertMissionState(applyStatusTransition(getMissionState(missionId), {
          status: "failed",
          failureReason: openResult.failureReason ?? "Open gate failed",
        }));
        setActiveMission(null);
        return;
      }
      upsertMissionState({ ...getMissionState(missionId), openResultRef: openResult.openResultRef });
    }

    // ── STEP 1: Capture browser viewport ───────────────────────────────────
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
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    if (captureResult.status !== "success" || !("screenshotRef" in captureResult) || !captureResult.screenshotRef) {
      const msg = ("failureReason" in captureResult ? captureResult.failureReason : null) ?? "screenshot capture failed";
      ctx.runtimeLogger.emit({ traceId: missionId, level: "error", modeVisibility: ["FLOW", "DEBUG", "TRACE"], eventType: "SCREENSHOT_CAPTURED", owner: "orchestration", missionId, runId, roundId, status: "failed", reason: msg });
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
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
        idempotencyKey: `grid:${missionId}:${roundId}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "grid render threw";
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
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
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    const coordinateGridScreenshotRef = gridResult.coordinateGridScreenshotRef;
    const gridSpecRef = gridResult.gridSpecRef;
    // Resolve AI-readable file paths (prefer explicit aiReadableImagePath field)
    const originalAiPath =
      "aiReadableImagePath" in captureResult && captureResult.aiReadableImagePath
        ? captureResult.aiReadableImagePath
        : originalScreenshotRef;
    const gridAiPath =
      "aiReadableImagePath" in gridResult && gridResult.aiReadableImagePath
        ? gridResult.aiReadableImagePath
        : coordinateGridScreenshotRef;

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
        postActionVerificationResultRef: null,
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
            // originalScreenshotRef is included as an evidence-chain ID only.
            // Its file bytes are NOT sent to the model — the grid screenshot below
            // already contains the same visual content with coordinate cells overlaid.
            // Sending both images overwhelms qwen2.5vl:3b (context overload → broken JSON).
            id: originalScreenshotRef,
            kind: "screenshot",
            summary: "original screenshot (ref only — not sent as image bytes to model)",
          },
          {
            // Grid screenshot is the ONLY physical image sent to the AI model.
            // It contains the original viewport + coordinate grid overlay.
            id: coordinateGridScreenshotRef,
            kind: "coordinate-grid-screenshot",
            summary: "coordinate grid overlay",
            filePath: gridAiPath,
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
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    if (aiResult.status === "review_required") {
      upsertMissionState(applyStatusTransition(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiResult.reviewRequiredReason ?? "AI requested review",
      }));
      return;
    }

    if (aiResult.status !== "success" || !aiResult.output) {
      const msg = aiResult.failureReason ?? "AI returned no output";
      upsertMissionState(applyStatusTransition(getMissionState(missionId), { status: "failed", failureReason: msg }));
      setActiveMission(null);
      return;
    }

    // ── STEP 4: Dispatch AI-driven action sequence ─────────────────────────
    const aiOutput = aiResult.output;

    // Hard-stop if AI decided review is required
    if (aiOutput.pageStateDecision === "review_required") {
      upsertMissionState(applyStatusTransition(getMissionState(missionId), {
        status: "review_required",
        reviewRequiredReason: aiOutput.reason ?? "AI: page state requires review",
      }));
      return;
    }

    const dispatchActions = aiOutput.actions
      .filter(a => a.actionCode !== "STOP_REVIEW_REQUIRED_ONCE")
      .map(action => {
        const entry = catalog.entries.find(e => e.actionCode === action.actionCode);
        return {
          actionCode: action.actionCode,
          reason: action.reason ?? null,
          targetRole: action.targetRole ?? null,
          abilityGroupId: entry?.abilityGroupId ?? null,
          childCapabilityId: entry?.childCapabilityId ?? null,
          inputOverrides: {
            ...(action.input ?? {}),
            ...(entry?.requiresGridSpecRef ? { gridSpecRef } : {}),
          },
          required: action.required ?? true,
          requiresGeometryProof: entry?.requiresGeometryProof ?? false,
          gridCell: (action.input?.["gridCell"] as string | undefined) ?? null,
        };
      });

    // Check for explicit STOP_REVIEW_REQUIRED_ONCE in AI actions
    const stopAction = aiOutput.actions.find(a => a.actionCode === "STOP_REVIEW_REQUIRED_ONCE");
    if (stopAction) {
      upsertMissionState(applyStatusTransition(getMissionState(missionId), {
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
      },
    );

    if (sequenceResult.status !== "success") {
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
        upsertMissionState(applyStatusTransition(getMissionState(missionId), {
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
    if (productDecision === "product_yes") {
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

    // ── Loop guard (after round) ────────────────────────────────────────────
    const stateAfter = getMissionState(missionId);
    const guardAfter = checkLoopGuardAfterRound(stateAfter);
    if (guardAfter.shouldStop) {
      if (guardAfter.reason !== "mission-not-running") {
        const finalized = applyStatusTransition(stateAfter, {
          status: "completed",
          stopReason: guardAfter.reason,
          endedAt: now(),
        });
        upsertMissionState(finalized);
        setActiveMission(null);
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

    // Brief pause between rounds to avoid hammering the browser/AI
    await new Promise<void>(r => setTimeout(r, 500));
  }
}
