import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import type { OrchestrationChildrenContext } from "../children-context.js";
import type { AiAbilityResult } from "../../ai/contract.js";
import type { VisualMissionActionPlanOutput } from "../../../types/visual-mission-action-plan.js";
import { cleanupRoundScreenshotArtifacts, primaryAiContextMaxWidthPx } from "./mission-loop-artifacts.js";
import type { RoundScreenContext } from "./mission-loop-screen.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";

const CELL_ZONE_REFERENCE_IMAGE_PATH = fileURLToPath(
  new URL("../../ai/assets/grid-cell-zone-reference.zh.png", import.meta.url),
);

type AiSuccess = AiAbilityResult & { status: "success"; output: VisualMissionActionPlanOutput };

type AiJudgeInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string;
  platformId: "facebook-web" | "tiktok-web";
  userRequirementText: string;
  catalogVersion: string;
  targetUrl?: string | null;
  targetTitle?: string | null;
  targetProfileRef?: string | null;
  screen: RoundScreenContext;
};

const failMission = (missionId: string, reason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), { status: "failed", failureReason: reason }));
  setActiveMission(null);
};

const cleanupAfterAi = async (input: AiJudgeInput, cleanupKind: "ai_failed" | "review_required"): Promise<void> => {
  await cleanupRoundScreenshotArtifacts({
    ctx: input.ctx,
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    cleanupKind,
    originalScreenshotRef: input.screen.originalScreenshotRef,
    coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
    extraTransientScreenshotRefs: input.screen.aiTransientScreenshotRefs,
    deleteOriginalScreenshot: true,
  });
};

const imageInputRefs = (input: AiJudgeInput) => [
  {
    id: input.screen.originalScreenshotRef,
    kind: "screenshot" as const,
    summary: `original current viewport screenshot, resized for AI maxWidth=${primaryAiContextMaxWidthPx}`,
    filePath: input.screen.primaryAiContextImageRefs[0],
  },
  {
    id: input.screen.coordinateGridScreenshotRef,
    kind: "coordinate-grid-screenshot" as const,
    summary: `coordinate grid overlay, resized for AI maxWidth=${primaryAiContextMaxWidthPx}`,
    filePath: input.screen.primaryAiContextImageRefs[1],
  },
  {
    id: "grasseye-fixed-cell-zone-reference-v1",
    kind: "cell-zone-reference" as const,
    summary: "fixed 3x3 cellZone reference diagram",
    filePath: CELL_ZONE_REFERENCE_IMAGE_PATH,
  },
];

const buildAiPlatformContext = (input: AiJudgeInput) => ({
  platformId: input.platformId,
  targetUrl: input.targetUrl ?? null,
  targetTitle: input.targetTitle ?? null,
  targetProfileRef: input.targetProfileRef ?? null,
});

const buildAiJudgeInputPayload = (input: AiJudgeInput) => ({
  userRequirementRef: null,
  userRequirementText: input.userRequirementText,
  systemManualRef: "system.v1",
  outputSchemaRef: "ai.visual_mission_judgment.v1",
  originalScreenshotRef: input.screen.originalScreenshotRef,
  coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
  gridSpecRef: input.screen.gridSpecRef,
  platformContextRef: input.platformId,
  platformContext: buildAiPlatformContext(input),
});

const buildAiJudgeRequest = (input: AiJudgeInput) => ({
  abilityGroupId: "ai" as const,
  missionId: input.missionId,
  runId: input.runId,
  sessionId: input.sessionId,
  roundId: input.roundId,
  videoVisitId: null,
  capabilityCallId: randomUUID(),
  nerveBusEnvelopeId: randomUUID(),
  requestedBy: "orchestration" as const,
  transportedBy: "nerve-bus" as const,
  taskType: "visual_mission_judgment" as const,
  promptContractId: "visual-mission-judge-v1",
  expectedOutputSchema: "ai.visual_mission_judgment.v1",
  inputRefs: imageInputRefs(input),
  userRequirementRef: null,
  userRequirementText: input.userRequirementText,
  platformId: input.platformId,
  originalScreenshotRef: input.screen.originalScreenshotRef,
  coordinateGridScreenshotRef: input.screen.coordinateGridScreenshotRef,
  gridSpecRef: input.screen.gridSpecRef,
  systemManualRef: "system.v1",
  muscleMemoryCatalogVersion: input.catalogVersion,
  continuityBundleRef: null,
  input: buildAiJudgeInputPayload(input),
});

const executeAiJudge = (input: AiJudgeInput): Promise<AiAbilityResult> =>
  input.ctx.aiAbilityGroup.execute(buildAiJudgeRequest(input));

const isAiSuccess = (result: AiAbilityResult): result is AiSuccess =>
  result.status === "success" && Boolean(result.output);

export const runAiVisualJudgment = async (input: AiJudgeInput): Promise<AiSuccess | null> => {
  const result = await executeAiJudge(input).catch(async (error: unknown) => {
    await cleanupAfterAi(input, "ai_failed");
    failMission(input.missionId, error instanceof Error ? error.message : "AI call threw");
    return null;
  });
  if (!result) return null;
  if (result.status === "review_required") {
    await cleanupAfterAi(input, "review_required");
    upsertMissionState(applyMissionStatus(getMissionState(input.missionId), {
      status: "review_required",
      reviewRequiredReason: result.reviewRequiredReason ?? "AI requested review",
    }));
    return null;
  }
  if (!isAiSuccess(result)) {
    await cleanupAfterAi(input, "ai_failed");
    failMission(input.missionId, result.failureReason ?? "AI returned no output");
    return null;
  }
  return result;
};
