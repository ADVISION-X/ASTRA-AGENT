import { OperationalMapSchema } from "../../schema.js";

export const humanReviewMap = OperationalMapSchema.parse({
  mapId: "human-review",
  displayName: "Human Review",
  humanGoal: "Hand mission state to Commander for governed review and wait for a decision.",
  allowedAbilityGroups: ["forensics-persistence"],
  initialStepId: "request-human-review",
  steps: [
    { stepId: "request-human-review", capabilityId: "orchestration", childCapabilityId: "request-human-review", stepKind: "review", targetAbilityGroupId: null, inputRefs: ["reviewReasonRef", "screenshotEvidenceRef", "aiResultRef"], outputRefPolicy: { storeAs: ["reviewReasonRef"] }, promptContractId: null, successCondition: { source: "status", equals: "review_required" }, failureBranch: "request-human-review:review", reviewBranch: "request-human-review:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "finalize-mission", capabilityId: "orchestration", childCapabilityId: "finalize-mission", stepKind: "finalize", targetAbilityGroupId: null, inputRefs: [], outputRefPolicy: { storeAs: [] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "finalize-mission:failed", reviewBranch: "finalize-mission:review", timeoutPolicy: { maxDurationMs: 1000 }, proofPolicy: { requiresRuntimeProof: true } }
  ],
  transitions: [
    { transitionId: "request-human-review:review", fromStepId: "request-human-review", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: null, finalStatus: "review_required" },
    { transitionId: "finalize-mission:success", fromStepId: "finalize-mission", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: null, finalStatus: "completed" },
    { transitionId: "finalize-mission:failed", fromStepId: "finalize-mission", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: null, finalStatus: "failed" },
    { transitionId: "finalize-mission:review", fromStepId: "finalize-mission", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null }
  ],
  failureBranches: ["finalize-mission:failed"],
  reviewBranches: ["request-human-review:review", "finalize-mission:review"],
  finalStates: ["completed", "failed", "review_required"],
  forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService"],
  sequencePolicy: { maxHops: 2, maxRetriesPerStep: 0, loopDecisionOnLimit: "review_required", branchPolicy: "allow_review_handoff" }
});
