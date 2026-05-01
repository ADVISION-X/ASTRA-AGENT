import { MissionExecutionResultSchema, MissionStateSchema, MissionStepResultSchema, OrchestrationExecuteResultSchema, RuntimeProofSchema } from "../schema.js";
import type { z } from "zod";

export function buildMissionStateUpdate(state: z.input<typeof MissionStateSchema>): z.output<typeof MissionStateSchema> {
  return MissionStateSchema.parse(state);
}

export function buildMissionExecutionResult(input: {
  missionState: z.input<typeof MissionStateSchema>;
  currentStepResult: z.input<typeof MissionStepResultSchema> | null;
  runtimeProof: z.input<typeof RuntimeProofSchema>;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): z.output<typeof MissionExecutionResultSchema> {
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

export function buildOrchestrationExecuteResult(input: {
  missionState: z.input<typeof MissionStateSchema>;
  currentStepResult: z.input<typeof MissionStepResultSchema> | null;
  runtimeProof: z.input<typeof RuntimeProofSchema>;
  failureReason?: string | null;
  reviewRequiredReason?: string | null;
  dataQualityFlags?: string[];
}): z.output<typeof OrchestrationExecuteResultSchema> {
  return OrchestrationExecuteResultSchema.parse({
    status: input.missionState.status,
    output: {
      missionState: input.missionState,
      currentStepResult: input.currentStepResult,
    },
    stateSnapshot: input.missionState,
    failureReason: input.failureReason ?? input.missionState.failureReason ?? null,
    reviewRequiredReason: input.reviewRequiredReason ?? input.missionState.reviewRequiredReason ?? null,
    runtimeProof: input.runtimeProof,
    policyDecision: "allowed",
    dataQualityFlags: input.dataQualityFlags ?? [],
  });
}
