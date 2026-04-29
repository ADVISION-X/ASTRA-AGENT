import { OperationalMapSchema } from "../../schema.js";

export const recoveryMap = OperationalMapSchema.parse({
  mapId: "recovery",
  displayName: "Recovery",
  humanGoal: "Stop automatic actions and hand state back to a governed recovery or review path.",
  allowedAbilityGroups: ["page-state"],
  initialStepId: "detect-page-abnormality",
  steps: [
    { stepId: "detect-page-abnormality", capabilityId: "orchestration", childCapabilityId: "detect-page-abnormality", stepKind: "ability", targetAbilityGroupId: "page-state", inputRefs: ["requestedPlatformId", "targetUrl"], outputRefPolicy: { storeAs: ["pageStateRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "detect-page-abnormality:failed", reviewBranch: "detect-page-abnormality:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "request-human-review", capabilityId: "orchestration", childCapabilityId: "request-human-review", stepKind: "review", targetAbilityGroupId: null, inputRefs: ["pageStateRef", "reviewReasonRef"], outputRefPolicy: { storeAs: ["reviewReasonRef"] }, promptContractId: null, successCondition: { source: "status", equals: "review_required" }, failureBranch: "request-human-review:review", reviewBranch: "request-human-review:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "finalize-mission", capabilityId: "orchestration", childCapabilityId: "finalize-mission", stepKind: "finalize", targetAbilityGroupId: null, inputRefs: [], outputRefPolicy: { storeAs: [] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "finalize-mission:failed", reviewBranch: "finalize-mission:review", timeoutPolicy: { maxDurationMs: 1000 }, proofPolicy: { requiresRuntimeProof: true } }
  ],
  transitions: [
    { transitionId: "detect-page-abnormality:success", fromStepId: "detect-page-abnormality", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "detect-page-abnormality:failed", fromStepId: "detect-page-abnormality", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "finalize-mission", finalStatus: null },
    { transitionId: "detect-page-abnormality:review", fromStepId: "detect-page-abnormality", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "request-human-review:review", fromStepId: "request-human-review", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: null, finalStatus: "review_required" },
    { transitionId: "finalize-mission:success", fromStepId: "finalize-mission", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: null, finalStatus: "completed" },
    { transitionId: "finalize-mission:failed", fromStepId: "finalize-mission", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: null, finalStatus: "failed" },
    { transitionId: "finalize-mission:review", fromStepId: "finalize-mission", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null }
  ],
  failureBranches: ["detect-page-abnormality:failed", "finalize-mission:failed"],
  reviewBranches: ["detect-page-abnormality:review", "request-human-review:review", "finalize-mission:review"],
  finalStates: ["completed", "failed", "review_required"],
  forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService"],
  sequencePolicy: { maxHops: 4, maxRetriesPerStep: 0, loopDecisionOnLimit: "failed", branchPolicy: "allow_review_handoff" }
});
