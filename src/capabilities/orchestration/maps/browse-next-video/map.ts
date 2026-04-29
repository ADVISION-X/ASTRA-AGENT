import { OperationalMapSchema } from "../../schema.js";

export const browseNextVideoMap = OperationalMapSchema.parse({
  mapId: "browse-next-video",
  displayName: "Browse Next Video",
  humanGoal: "Move the live session to the next candidate video through governed scroll execution.",
  allowedAbilityGroups: ["visual-target", "mouse-scroll", "post-action-verification"],
  initialStepId: "detect-next-video-region",
  steps: [
    { stepId: "detect-next-video-region", capabilityId: "orchestration", childCapabilityId: "detect-next-video-region", stepKind: "ability", targetAbilityGroupId: "visual-target", inputRefs: ["screenshotEvidenceRef"], outputRefPolicy: { storeAs: ["visualTargetRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "detect-next-video-region:failed", reviewBranch: "detect-next-video-region:review", timeoutPolicy: { maxDurationMs: 8000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "scroll-next-video", capabilityId: "orchestration", childCapabilityId: "scroll-browser-viewport", stepKind: "ability", targetAbilityGroupId: "mouse-scroll", inputRefs: ["visualTargetRef", "geometryProofRef"], outputRefPolicy: { storeAs: ["abilityResultRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "scroll-next-video:failed", reviewBranch: "scroll-next-video:review", timeoutPolicy: { maxDurationMs: 8000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "verify-scroll-result", capabilityId: "orchestration", childCapabilityId: "verify-scroll-result", stepKind: "ability", targetAbilityGroupId: "post-action-verification", inputRefs: ["abilityResultRef", "pageStateRef"], outputRefPolicy: { storeAs: ["abilityResultRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "verify-scroll-result:failed", reviewBranch: "verify-scroll-result:review", timeoutPolicy: { maxDurationMs: 8000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "request-human-review", capabilityId: "orchestration", childCapabilityId: "request-human-review", stepKind: "review", targetAbilityGroupId: null, inputRefs: ["reviewReasonRef", "abilityResultRef"], outputRefPolicy: { storeAs: ["reviewReasonRef"] }, promptContractId: null, successCondition: { source: "status", equals: "review_required" }, failureBranch: "request-human-review:review", reviewBranch: "request-human-review:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "finalize-mission", capabilityId: "orchestration", childCapabilityId: "finalize-mission", stepKind: "finalize", targetAbilityGroupId: null, inputRefs: ["abilityResultRef"], outputRefPolicy: { storeAs: [] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "finalize-mission:failed", reviewBranch: "finalize-mission:review", timeoutPolicy: { maxDurationMs: 1000 }, proofPolicy: { requiresRuntimeProof: true } }
  ],
  transitions: [
    { transitionId: "detect-next-video-region:success", fromStepId: "detect-next-video-region", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "scroll-next-video", finalStatus: null },
    { transitionId: "detect-next-video-region:failed", fromStepId: "detect-next-video-region", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "detect-next-video-region:review", fromStepId: "detect-next-video-region", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "scroll-next-video:success", fromStepId: "scroll-next-video", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "verify-scroll-result", finalStatus: null },
    { transitionId: "scroll-next-video:failed", fromStepId: "scroll-next-video", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "scroll-next-video:review", fromStepId: "scroll-next-video", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "verify-scroll-result:success", fromStepId: "verify-scroll-result", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "finalize-mission", finalStatus: null },
    { transitionId: "verify-scroll-result:failed", fromStepId: "verify-scroll-result", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "verify-scroll-result:review", fromStepId: "verify-scroll-result", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "request-human-review:review", fromStepId: "request-human-review", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: null, finalStatus: "review_required" },
    { transitionId: "finalize-mission:success", fromStepId: "finalize-mission", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: null, finalStatus: "completed" },
    { transitionId: "finalize-mission:failed", fromStepId: "finalize-mission", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: null, finalStatus: "failed" },
    { transitionId: "finalize-mission:review", fromStepId: "finalize-mission", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null }
  ],
  failureBranches: ["detect-next-video-region:failed", "scroll-next-video:failed", "verify-scroll-result:failed", "finalize-mission:failed"],
  reviewBranches: ["detect-next-video-region:review", "scroll-next-video:review", "verify-scroll-result:review", "request-human-review:review", "finalize-mission:review"],
  finalStates: ["completed", "failed", "review_required"],
  forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService"],
  sequencePolicy: { maxHops: 6, maxRetriesPerStep: 1, loopDecisionOnLimit: "review_required", branchPolicy: "allow_review_handoff" }
});
