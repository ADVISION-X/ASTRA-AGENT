import type { OrchestrationChildrenContext } from "../children-context.js";
import type { MissionState } from "../contract.js";
import { dispatchRegisteredAbilityAction } from "./dispatch-action.js";
import { cleanupRoundScreenshotArtifacts } from "./mission-loop-artifacts.js";
import { runAiVisualJudgment } from "./mission-loop-ai.js";
import { failMissingNextAction, stopForTerminalAiDecision } from "./mission-loop-decision.js";
import { maybeOpenInitialPlatformEntry } from "./mission-loop-open.js";
import { saveRoundEvidenceIfRequested } from "./mission-loop-save.js";
import { prepareRoundScreenContext, type RoundScreenContext } from "./mission-loop-screen.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";
import { loadMuscleMemoryCatalog } from "../../../muscle-memory/catalog.js";

type ValidPlatformId = "facebook-web" | "tiktok-web";
type RoundResult = "continue" | "stop";

type RoundInput = {
  missionId: string;
  runId: string;
  roundId: string;
  sessionId: string;
  state: MissionState;
  ctx: OrchestrationChildrenContext;
  catalog: ReturnType<typeof loadMuscleMemoryCatalog>;
};

const validateRoundRequest = (input: RoundInput): { platformId: ValidPlatformId; userRequirementText: string } | null => {
  const requestedPlatform = input.state.requestedPlatform;
  if (requestedPlatform !== "facebook-web" && requestedPlatform !== "tiktok-web") {
    failRound(input.missionId, `INVALID_PLATFORM: requestedPlatform=${requestedPlatform ?? "missing"}`);
    return null;
  }
  if (!input.state.humanGoal) {
    failRound(input.missionId, "MISSING_USER_REQUIREMENT: humanGoal is required");
    return null;
  }
  return { platformId: requestedPlatform, userRequirementText: input.state.humanGoal };
};

const failRound = (missionId: string, failureReason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason }));
  setActiveMission(null);
};

const emitRoundStarted = (input: RoundInput): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "ROUND_STARTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "started",
    reason: `Round ${input.state.roundIndex ?? 0} started`,
  });
};

const emitAiDecisionSummary = (input: RoundInput, aiOutput: { goalMatched: boolean; save: boolean; decision: string; nextAction?: { actionCode: string } | null }): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "AI_DECISION_SUMMARY",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status: "success",
    reason: `goalMatched=${aiOutput.goalMatched} save=${aiOutput.save} decision=${aiOutput.decision} nextAction=${aiOutput.nextAction?.actionCode ?? "none"}`,
    metrics: { actionCount: aiOutput.nextAction ? 1 : 0 },
  });
};

const dispatchNextAction = async (
  input: RoundInput,
  screen: RoundScreenContext,
  aiResultRef: string | null,
  nextAction: NonNullable<Parameters<typeof failMissingNextAction>[0]["aiOutput"]["nextAction"]>,
) => {
  const actionInput = { ...(nextAction.input ?? {}) };
  const entry = input.catalog.entries.find((item) => item.actionCode === nextAction.actionCode);
  return dispatchRegisteredAbilityAction({
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    aiResultRef,
    action: {
      actionCode: nextAction.actionCode,
      reason: nextAction.reason ?? null,
      input: { ...actionInput, ...(entry?.requiresGridSpecRef ? { gridSpecRef: screen.gridSpecRef } : {}) },
      required: true,
      gridCell: nextAction.gridCell ?? (actionInput["gridCell"] as string | undefined) ?? null,
      cellZone: nextAction.cellZone ?? (actionInput["cellZone"] as never),
    },
    currentEvidenceRefs: {
      originalScreenshotRef: screen.originalScreenshotRef,
      coordinateGridScreenshotRef: screen.coordinateGridScreenshotRef,
      gridSpecRef: screen.gridSpecRef,
    },
  }, {
    nerveBus: input.ctx.nerveBus,
    forensics: input.ctx.forensics,
    geometryGuard: input.ctx.geometryGuard,
    screenshotAbilityGroup: input.ctx.screenshotAbilityGroup,
    runtimeLogger: input.ctx.runtimeLogger,
  });
};

const handleDispatchFailure = async (
  input: RoundInput,
  screen: RoundScreenContext,
  evidenceSaved: boolean,
  actionResult: Awaited<ReturnType<typeof dispatchNextAction>>,
): Promise<RoundResult> => {
  await cleanupRoundScreenshotArtifacts({ ctx: input.ctx, missionId: input.missionId, runId: input.runId, roundId: input.roundId, cleanupKind: "dispatch_failed", originalScreenshotRef: screen.originalScreenshotRef, coordinateGridScreenshotRef: screen.coordinateGridScreenshotRef, extraTransientScreenshotRefs: screen.aiTransientScreenshotRefs, deleteOriginalScreenshot: !evidenceSaved });
  const state = getMissionState(input.missionId);
  upsertMissionState({ ...state, lastActionStatus: actionResult.status, lastFailureReason: actionResult.failureReason ?? null, lastReviewRequiredReason: actionResult.reviewRequiredReason ?? null });
  if (state.status !== "running") return "stop";
  if (actionResult.status === "failed") failRound(input.missionId, actionResult.failureReason ?? "action dispatch failed");
  return "stop";
};

const cleanupDispatchSuccess = async (
  input: RoundInput,
  screen: RoundScreenContext,
  evidenceSaved: boolean,
): Promise<void> => {
  const state = getMissionState(input.missionId);
  upsertMissionState({ ...state, lastActionStatus: "success", lastFailureReason: null });
  await cleanupRoundScreenshotArtifacts({ ctx: input.ctx, missionId: input.missionId, runId: input.runId, roundId: input.roundId, cleanupKind: evidenceSaved ? "matched_evidence" : "no_match", originalScreenshotRef: screen.originalScreenshotRef, coordinateGridScreenshotRef: screen.coordinateGridScreenshotRef, extraTransientScreenshotRefs: screen.aiTransientScreenshotRefs, deleteOriginalScreenshot: !evidenceSaved });
};

type PreparedRoundExecution = {
  validated: NonNullable<ReturnType<typeof validateRoundRequest>>;
  screen: RoundScreenContext;
  aiResult: NonNullable<Awaited<ReturnType<typeof runAiVisualJudgment>>>;
  aiResultRef: string | null;
  saved: boolean;
};

const prepareRoundStart = async (input: RoundInput): Promise<{
  validated: NonNullable<ReturnType<typeof validateRoundRequest>>;
  screen: RoundScreenContext;
} | null> => {
  const validated = validateRoundRequest(input);
  if (!validated) return null;
  emitRoundStarted(input);
  if (!await maybeOpenInitialPlatformEntry(input)) return null;
  const screen = await prepareRoundScreenContext({ ...input, roundIndex: input.state.roundIndex ?? 0 });
  return screen ? { validated, screen } : null;
};

const prepareRoundAiExecution = async (
  input: RoundInput,
  validated: NonNullable<ReturnType<typeof validateRoundRequest>>,
  screen: RoundScreenContext,
): Promise<Pick<PreparedRoundExecution, "aiResult" | "aiResultRef" | "saved"> | null> => {
  const aiResult = await runAiVisualJudgment({ ...input, ...validated, catalogVersion: input.catalog.catalogVersion, targetUrl: input.state.targetUrl ?? null, targetTitle: input.state.targetTitle ?? null, targetProfileRef: input.state.targetProfileRef ?? null, screen });
  if (!aiResult) return null;
  emitAiDecisionSummary(input, aiResult.output);
  const aiResultRef = aiResult.runtimeProof?.proofId ?? null;
  const saved = await saveRoundEvidenceIfRequested({ ...input, userRequirementText: validated.userRequirementText, aiResultRef, aiOutput: aiResult.output, screen });
  if (saved === null) return null;
  if (await stopForTerminalAiDecision({ ...input, aiOutput: aiResult.output, evidenceSaved: saved, screen })) return null;
  return { aiResult, aiResultRef, saved };
};

const prepareRoundExecution = async (input: RoundInput): Promise<PreparedRoundExecution | null> => {
  const start = await prepareRoundStart(input);
  if (!start) return null;
  const aiExecution = await prepareRoundAiExecution(input, start.validated, start.screen);
  if (!aiExecution) return null;
  return { validated: start.validated, screen: start.screen, ...aiExecution };
};

export const runMissionRound = async (input: RoundInput): Promise<RoundResult> => {
  const prepared = await prepareRoundExecution(input);
  if (!prepared) return "stop";
  const decisionInput = { ...input, aiOutput: prepared.aiResult.output, evidenceSaved: prepared.saved, screen: prepared.screen };
  if (!prepared.aiResult.output.nextAction) {
    await failMissingNextAction(decisionInput);
    return "stop";
  }
  const actionResult = await dispatchNextAction(input, prepared.screen, prepared.aiResultRef, prepared.aiResult.output.nextAction);
  if (actionResult.status !== "success") return await handleDispatchFailure(input, prepared.screen, prepared.saved, actionResult);
  await cleanupDispatchSuccess(input, prepared.screen, prepared.saved);
  return "continue";
};
