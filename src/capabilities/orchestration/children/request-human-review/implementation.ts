import type { OrchestrationChildCapability, RequestHumanReviewChildInput, RequestHumanReviewChildOutput } from "../../contract.js";
import { buildMissionStateUpdate } from "../../runtime/orchestration-result-builder.js";

export function createRequestHumanReviewCapability(): OrchestrationChildCapability<RequestHumanReviewChildInput, RequestHumanReviewChildOutput> {
  return {
    abilityGroupId: "orchestration",
    childCapabilityId: "request-human-review",
    async execute(input, context) {
      const state = await context.statePort.getMissionState(input.missionId);
      const now = context.clock.now().isoTimestamp;
      const nextState = buildMissionStateUpdate({
        ...state,
        status: "review_required",
        reviewRequiredReason: input.reason,
        updatedAt: now,
        endedAt: now,
      });
      await context.statePort.putMissionState(nextState);
      return nextState;
    },
  };
}
