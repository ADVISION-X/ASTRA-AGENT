import { OperationalMapSchema } from "../../schema.js";

export const commentEvidenceMap = OperationalMapSchema.parse({
  mapId: "comment-evidence",
  displayName: "Comment Evidence",
  humanGoal: "Collect comment-panel evidence after a product-positive video detection.",
  allowedAbilityGroups: ["visual-target", "mouse-click", "screenshot", "forensics-persistence"],
  initialStepId: "detect-comments-button",
  steps: [
    { stepId: "detect-comments-button", capabilityId: "orchestration", childCapabilityId: "detect-comments-button", stepKind: "ability", targetAbilityGroupId: "visual-target", inputRefs: ["screenshotEvidenceRef"], outputRefPolicy: { storeAs: ["visualTargetRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "detect-comments-button:failed", reviewBranch: "detect-comments-button:review", timeoutPolicy: { maxDurationMs: 8000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "click-comments-button", capabilityId: "orchestration", childCapabilityId: "click-browser-coordinate", stepKind: "ability", targetAbilityGroupId: "mouse-click", inputRefs: ["visualTargetRef", "geometryProofRef"], outputRefPolicy: { storeAs: ["abilityResultRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "click-comments-button:failed", reviewBranch: "click-comments-button:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "capture-comments-panel", capabilityId: "orchestration", childCapabilityId: "capture-region", stepKind: "ability", targetAbilityGroupId: "screenshot", inputRefs: ["visualTargetRef", "targetUrl"], outputRefPolicy: { storeAs: ["commentsEvidenceRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "capture-comments-panel:failed", reviewBranch: "capture-comments-panel:review", timeoutPolicy: { maxDurationMs: 10000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "persist-comment-evidence", capabilityId: "orchestration", childCapabilityId: "write-evidence-record", stepKind: "ability", targetAbilityGroupId: "forensics-persistence", inputRefs: ["commentsEvidenceRef", "screenshotEvidenceRef"], outputRefPolicy: { storeAs: ["abilityResultRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "persist-comment-evidence:failed", reviewBranch: "persist-comment-evidence:review", timeoutPolicy: { maxDurationMs: 10000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "request-human-review", capabilityId: "orchestration", childCapabilityId: "request-human-review", stepKind: "review", targetAbilityGroupId: null, inputRefs: ["reviewReasonRef", "commentsEvidenceRef"], outputRefPolicy: { storeAs: ["reviewReasonRef"] }, promptContractId: null, successCondition: { source: "status", equals: "review_required" }, failureBranch: "request-human-review:review", reviewBranch: "request-human-review:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "finalize-mission", capabilityId: "orchestration", childCapabilityId: "finalize-mission", stepKind: "finalize", targetAbilityGroupId: null, inputRefs: ["abilityResultRef"], outputRefPolicy: { storeAs: [] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "finalize-mission:failed", reviewBranch: "finalize-mission:review", timeoutPolicy: { maxDurationMs: 1000 }, proofPolicy: { requiresRuntimeProof: true } }
  ],
  transitions: [
    { transitionId: "detect-comments-button:success", fromStepId: "detect-comments-button", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "click-comments-button", finalStatus: null },
    { transitionId: "detect-comments-button:failed", fromStepId: "detect-comments-button", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "detect-comments-button:review", fromStepId: "detect-comments-button", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "click-comments-button:success", fromStepId: "click-comments-button", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "capture-comments-panel", finalStatus: null },
    { transitionId: "click-comments-button:failed", fromStepId: "click-comments-button", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "click-comments-button:review", fromStepId: "click-comments-button", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "capture-comments-panel:success", fromStepId: "capture-comments-panel", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "persist-comment-evidence", finalStatus: null },
    { transitionId: "capture-comments-panel:failed", fromStepId: "capture-comments-panel", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "capture-comments-panel:review", fromStepId: "capture-comments-panel", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "persist-comment-evidence:success", fromStepId: "persist-comment-evidence", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "finalize-mission", finalStatus: null },
    { transitionId: "persist-comment-evidence:failed", fromStepId: "persist-comment-evidence", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "persist-comment-evidence:review", fromStepId: "persist-comment-evidence", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "request-human-review:review", fromStepId: "request-human-review", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: null, finalStatus: "review_required" },
    { transitionId: "finalize-mission:success", fromStepId: "finalize-mission", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: null, finalStatus: "completed" },
    { transitionId: "finalize-mission:failed", fromStepId: "finalize-mission", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: null, finalStatus: "failed" },
    { transitionId: "finalize-mission:review", fromStepId: "finalize-mission", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null }
  ],
  failureBranches: ["detect-comments-button:failed", "click-comments-button:failed", "capture-comments-panel:failed", "persist-comment-evidence:failed", "finalize-mission:failed"],
  reviewBranches: ["detect-comments-button:review", "click-comments-button:review", "capture-comments-panel:review", "persist-comment-evidence:review", "request-human-review:review", "finalize-mission:review"],
  finalStates: ["completed", "failed", "review_required"],
  forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService"],
  sequencePolicy: { maxHops: 8, maxRetriesPerStep: 1, loopDecisionOnLimit: "review_required", branchPolicy: "allow_review_handoff" }
});
