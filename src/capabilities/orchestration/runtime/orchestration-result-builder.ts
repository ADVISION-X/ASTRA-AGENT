import type { MissionExecutionResult, MissionState, MissionStepResult, RuntimeProof } from "../contract.js";
import { MissionExecutionResultSchema, MissionStateSchema } from "../schema.js";
import type { z } from "zod";

export function buildMissionStateUpdate(state: z.input<typeof MissionStateSchema>): MissionState {
  return MissionStateSchema.parse(state);
}

export function buildMissionExecutionResult(input: {
  missionState: MissionState;
  currentStepResult: MissionStepResult | null;
  runtimeProof: RuntimeProof;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): MissionExecutionResult {
  const status = input.missionState.status;
  const isTerminalOrReview = status === "completed" || status === "failed" || status === "stopped" || status === "review_required";
  const output = isTerminalOrReview && status !== "failed" && status !== "stopped"
    ? {
        missionState: input.missionState,
        currentStepResult: input.currentStepResult,
      }
    : null;

  return MissionExecutionResultSchema.parse({
    status,
    output,
    stateSnapshot: input.missionState,
    failureReason: input.failureReason ?? input.missionState.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? input.missionState.reviewRequiredReason ?? null,
    runtimeProof: input.runtimeProof,
    policyDecision: "allowed",
    dataQualityFlags: input.dataQualityFlags ?? [],
  });
}
