import assert from "node:assert/strict";
import test from "node:test";

import { findAiPromptContractCatalogEntry } from "../../ai/index.js";
import { MissionStateSchema, RuntimePlanSchema } from "../schema.js";
import { resolveRoundMissionPacket } from "../../../visual-mission/round-mission-packet-store.js";
import { buildAiStepResult } from "./step-dispatch-ai.js";
import { buildNextMissionRoundState } from "./orchestration-round-state.js";
import { buildAiDispatchAugmentation } from "./visual-mission-ai-dispatch-context.js";
import type { AiStep } from "./step-dispatch-shared.js";

const promptContract = findAiPromptContractCatalogEntry("visual-mission-action-plan-v1");
if (!promptContract) {
  throw new Error("visual-mission-action-plan-v1 prompt contract must exist for runtime tests.");
}

const baseState = MissionStateSchema.parse({
  missionId: "mission-1",
  mapId: "map-1",
  activeTaskRunId: "run-1",
  requestedPlatform: "tiktok-web",
  selectedPlatforms: ["tiktok-web"],
  userRequirementRef: "user-requirement:1",
  humanGoal: "Find seeding videos and stop only when human review is required.",
  status: "running",
  currentStepId: "visual-mission-plan",
  previousStepId: "prepare-visual-mission-input",
  currentRoundIndex: 2,
  stateRevision: 4,
  hopCount: 7,
  configuredMaxRounds: 9,
  configuredMaxMinutes: 15,
  roundProgress: {
    savedLeadCount: 1,
    skippedCount: 2,
    reviewRequiredCount: 0,
    failedActionCount: 1,
    consecutiveFailureCount: 0,
  },
  lastActionSummary: {
    sourceActionCode: "NEXT_VIDEO",
    status: "success",
    gridCell: "D42",
    targetName: "next_video_target",
    summary: "NEXT_VIDEO executed.",
    actionInputRef: "action-input:next-video",
    outputRef: "click-result:next-video",
    failureReason: null,
    completedAt: "2026-05-11T00:00:00.000Z",
  },
  payloadRefs: {
    userRequirementRef: "user-requirement:1",
    targetUrl: "https://example.com/watch/1",
    targetTitle: "Example Target Video",
    targetProfileRef: "platform-profile:tiktok-web",
    originalScreenshotRef: "original-screenshot:1",
    coordinateGridScreenshotRef: "coordinate-grid:1",
    gridSpecRef: "grid-spec:1",
    visualMissionInputRef: "visual-mission-input:1",
    sourceAiResultRef: "ai-result:previous",
    pageStateRef: "page-state:1",
    postActionVerificationResultRef: "pav:1",
  },
});

const baseMap = RuntimePlanSchema.parse({
  mapId: "map-1",
  initialStepId: "visual-mission-plan",
  requestedPlatformId: "tiktok-web",
  persistentPayloadRefs: [],
  steps: [],
  transitions: [],
  sequencePolicy: {
    maxHops: 20,
    maxRetriesPerStep: 0,
    loopDecisionOnLimit: "failed",
    branchPolicy: "strict",
  },
  proofPolicy: {
    requiresRuntimeProof: true,
  },
});

const aiStep: AiStep = {
  stepId: "visual-mission-plan",
  kind: "ai",
  stepKind: "ai",
  targetAbilityGroupId: null,
  childCapabilityId: "visual-mission-action-plan",
  promptContractId: "visual-mission-action-plan-v1",
  inputRefs: [],
  outputRefPolicy: {
    storeAs: ["aiResultRef"],
  },
};

test("buildAiDispatchAugmentation derives and stores a round mission packet", () => {
  const augmentation = buildAiDispatchAugmentation({
    state: baseState,
    promptContract,
  });

  assert.match(augmentation.payloadRefs.systemManualRef ?? "", /^system-manual:/u);
  assert.equal(augmentation.payloadRefs.outputSchemaRef, "ai.visual_mission_action_plan.v1");
  assert.equal(augmentation.payloadRefs.platformContextRef, "mission-1:platform-context");
  assert.equal(augmentation.payloadRefs.roundMissionPacketRef, "mission-1:round-mission-packet:2:4");

  const packet = resolveRoundMissionPacket(augmentation.payloadRefs.roundMissionPacketRef);
  assert.ok(packet);
  assert.equal(packet?.mission.userRequirementText, baseState.humanGoal);
  assert.equal(packet?.mission.maxRounds, 9);
  assert.equal(packet?.mission.maxMinutes, 15);
  assert.equal(packet?.round.roundId, "mission-1:round:2");
  assert.equal(packet?.round.previousRoundId, "mission-1:round:1");
  assert.equal(packet?.round.currentPhase, "visual-mission-plan");
  assert.equal(packet?.progress.skippedCount, 2);
  assert.equal(packet?.lastAction.sourceActionCode, "NEXT_VIDEO");
  assert.equal(packet?.lastAction.status, "success");
  assert.equal(packet?.platformContext.platformId, "tiktok-web");
  assert.equal(packet?.platformContext.platformContextRef, "mission-1:platform-context");
  assert.equal(packet?.currentEvidence.aiResultRef, "ai-result:previous");
  assert.equal(packet?.constraints.noHumanInLoop, true);
  assert.equal(packet?.allowedActions.systemManualRef, augmentation.payloadRefs.systemManualRef);
});

test("buildNextMissionRoundState updates lastAction and counters from branch fields", () => {
  const nextRoundState = buildNextMissionRoundState({
    state: baseState,
    lastResult: {
      branchFieldValues: {
        lastActionSourceActionCode: "SAVE_LEAD",
        lastActionStatus: "success",
        lastActionGridCell: "B12",
        lastActionTargetName: "save_button",
        lastActionSummary: "SAVE_LEAD executed.",
        lastActionActionInputRef: "action-input:save-lead",
        lastActionOutputRef: "lead-record:1",
        lastActionCompletedAt: "2026-05-11T01:00:00.000Z",
        lastActionFailureReason: null,
      },
    },
  });

  assert.equal(nextRoundState.roundProgress.savedLeadCount, 2);
  assert.equal(nextRoundState.roundProgress.skippedCount, 2);
  assert.equal(nextRoundState.roundProgress.consecutiveFailureCount, 0);
  assert.equal(nextRoundState.lastActionSummary.sourceActionCode, "SAVE_LEAD");
  assert.equal(nextRoundState.lastActionSummary.outputRef, "lead-record:1");
});

test("buildNextMissionRoundState preserves failed lastAction details and increments consecutiveFailureCount", () => {
  const nextRoundState = buildNextMissionRoundState({
    state: baseState,
    lastResult: {
      branchFieldValues: {
        lastActionSourceActionCode: "NEXT_VIDEO",
        lastActionStatus: "failed",
        lastActionGridCell: "K50",
        lastActionTargetName: "next_video_button",
        lastActionSummary: "NEXT_VIDEO failed.",
        lastActionActionInputRef: "action-input:next-video",
        lastActionOutputRef: null,
        lastActionCompletedAt: "2026-05-11T01:05:00.000Z",
        lastActionFailureReason: "click target not visible",
      },
    },
  });

  assert.equal(nextRoundState.roundProgress.failedActionCount, 2);
  assert.equal(nextRoundState.roundProgress.consecutiveFailureCount, 1);
  assert.equal(nextRoundState.lastActionSummary.status, "failed");
  assert.equal(nextRoundState.lastActionSummary.failureReason, "click target not visible");
  assert.equal(nextRoundState.lastActionSummary.gridCell, "K50");
});

test("buildAiStepResult preserves review_required instead of normalizing to failed", () => {
  const stepResult = buildAiStepResult({
    state: baseState,
    map: baseMap,
    step: aiStep,
    missionId: "mission-1",
    dispatchResult: {
      status: "review_required",
      envelopeId: "envelope-1",
      resultRef: "result-1",
      decision: null,
      actionPlan: null,
      branchFieldValues: {},
      failureReason: "model requested human review",
      payloadRefs: {
        ...baseState.payloadRefs,
        aiResultRef: "ai-result:1",
      },
    },
  });

  assert.equal(stepResult.dispatched, true);
  if (!stepResult.dispatched) {
    throw new Error("AI step must dispatch in this test.");
  }
  assert.equal(stepResult.stepResult.status, "review_required");
  assert.equal(stepResult.stepResult.failureReason, null);
  assert.equal(stepResult.stepResult.reviewRequiredReason, "model requested human review");
});
