import { createId } from "../../lib/local-runtime/ids.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";

type FacebookMiningStatus = FacebookProductVideoMiningContracts["FacebookMiningStatus"];
type FacebookProductVideoMiningMissionInput = FacebookProductVideoMiningContracts["FacebookProductVideoMiningMissionInput"];
type FacebookProductVideoMiningRoundState = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRoundState"];
type FacebookProductVideoMiningRunConfig = FacebookProductVideoMiningContracts["FacebookProductVideoMiningRunConfig"];

const createFacebookMiningMissionId = (): string => createId("facebook_mission");
const createFacebookMiningRunId = (): string => createId("facebook_run");
const createFacebookMiningRoundId = (): string => createId("facebook_round");
export const createFacebookMiningCandidateId = (): string => createId("facebook_candidate");
export const createFacebookMiningAiJudgmentId = (): string => createId("facebook_ai_judgment");

export const buildFacebookMiningRunConfig = (
  rawInput: FacebookProductVideoMiningMissionInput,
): FacebookProductVideoMiningRunConfig => {
  const input = FacebookProductVideoMiningSchemas.FacebookProductVideoMiningMissionInputSchema.parse(rawInput);
  return {
    ...input,
    missionId: input.missionId ?? createFacebookMiningMissionId(),
    modelName: input.modelName ?? null,
    runId: createFacebookMiningRunId(),
    startedAt: new Date().toISOString(),
  };
};

export const buildFacebookMiningRoundState = (input: {
  run: FacebookProductVideoMiningRunConfig;
  roundIndex: number;
}): FacebookProductVideoMiningRoundState => ({
  missionId: input.run.missionId,
  runId: input.run.runId,
  roundId: createFacebookMiningRoundId(),
  roundIndex: input.roundIndex,
  status: "running",
  startedAt: new Date().toISOString(),
  endedAt: null,
  sourcePageUrl: null,
  candidateId: null,
  reason: null,
});

const resolveIncompleteTerminalStatus = (input: {
  timedOut: boolean;
  maxRoundsReached: boolean;
  reviewRequired: boolean;
  failed: boolean;
}): FacebookMiningStatus => {
  if (input.reviewRequired) {
    return "review_required";
  }
  if (input.failed) {
    return "failed";
  }
  if (input.maxRoundsReached) {
    return "max_rounds_reached";
  }
  if (input.timedOut) {
    return "max_minutes_reached";
  }
  return "running";
};

export const resolveTerminalRunStatus = (input: {
  savedProductCount: number;
  targetProductCount: number;
  timedOut: boolean;
  maxRoundsReached: boolean;
  reviewRequired: boolean;
  failed: boolean;
}): FacebookMiningStatus => {
  if (input.savedProductCount >= input.targetProductCount) {
    return "completed";
  }
  return resolveIncompleteTerminalStatus(input);
};