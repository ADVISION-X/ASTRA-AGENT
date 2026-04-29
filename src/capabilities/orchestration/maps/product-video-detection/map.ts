import { OperationalMapSchema } from "../../schema.js";

export const productVideoDetectionMap = OperationalMapSchema.parse({
  mapId: "product-video-detection",
  displayName: "Product Video Detection",
  humanGoal: "Detect whether the current short video likely contains a product opportunity.",
  allowedAbilityGroups: ["page-state", "screenshot", "ai", "forensics-persistence"],
  initialStepId: "detect-feed-ready",
  steps: [
    { stepId: "detect-feed-ready", capabilityId: "orchestration", childCapabilityId: "detect-feed-ready", stepKind: "ability", targetAbilityGroupId: "page-state", inputRefs: ["requestedPlatformId", "targetUrl"], outputRefPolicy: { storeAs: ["pageStateRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "detect-feed-ready:failed", reviewBranch: "detect-feed-ready:review", timeoutPolicy: { maxDurationMs: 5000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "capture-video-viewport", capabilityId: "orchestration", childCapabilityId: "capture-browser-viewport", stepKind: "ability", targetAbilityGroupId: "screenshot", inputRefs: ["targetUrl", "targetTitle"], outputRefPolicy: { storeAs: ["screenshotEvidenceRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "capture-video-viewport:failed", reviewBranch: "capture-video-viewport:review", timeoutPolicy: { maxDurationMs: 10000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "ask-product-presence", capabilityId: "orchestration", childCapabilityId: "product-presence-judgment", stepKind: "ai", targetAbilityGroupId: "ai", inputRefs: ["screenshotEvidenceRef"], outputRefPolicy: { storeAs: ["aiResultRef"] }, promptContractId: "vision.productPresence.v1", successCondition: { source: "decision", equals: "product_yes" }, failureBranch: "ask-product-presence:failed", reviewBranch: "ask-product-presence:review", timeoutPolicy: { maxDurationMs: 15000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "persist-detection-log", capabilityId: "orchestration", childCapabilityId: "write-structured-runtime-event", stepKind: "ability", targetAbilityGroupId: "forensics-persistence", inputRefs: ["screenshotEvidenceRef", "aiResultRef"], outputRefPolicy: { storeAs: ["abilityResultRef"] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "persist-detection-log:failed", reviewBranch: "persist-detection-log:review", timeoutPolicy: { maxDurationMs: 10000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "request-human-review", capabilityId: "orchestration", childCapabilityId: "request-human-review", stepKind: "review", targetAbilityGroupId: null, inputRefs: ["reviewReasonRef", "screenshotEvidenceRef", "aiResultRef"], outputRefPolicy: { storeAs: ["reviewReasonRef"] }, promptContractId: null, successCondition: { source: "status", equals: "review_required" }, failureBranch: "request-human-review:review", reviewBranch: "request-human-review:review", timeoutPolicy: { maxDurationMs: 10000 }, proofPolicy: { requiresRuntimeProof: true } },
    { stepId: "finalize-mission", capabilityId: "orchestration", childCapabilityId: "finalize-mission", stepKind: "finalize", targetAbilityGroupId: null, inputRefs: ["abilityResultRef"], outputRefPolicy: { storeAs: [] }, promptContractId: null, successCondition: { source: "status", equals: "success" }, failureBranch: "finalize-mission:failed", reviewBranch: "finalize-mission:review", timeoutPolicy: { maxDurationMs: 1000 }, proofPolicy: { requiresRuntimeProof: true } },
  ],
  transitions: [
    { transitionId: "detect-feed-ready:success", fromStepId: "detect-feed-ready", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "capture-video-viewport", finalStatus: null },
    { transitionId: "detect-feed-ready:failed", fromStepId: "detect-feed-ready", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "detect-feed-ready:review", fromStepId: "detect-feed-ready", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "capture-video-viewport:success", fromStepId: "capture-video-viewport", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "ask-product-presence", finalStatus: null },
    { transitionId: "capture-video-viewport:failed", fromStepId: "capture-video-viewport", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "capture-video-viewport:review", fromStepId: "capture-video-viewport", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "ask-product-presence:success", fromStepId: "ask-product-presence", onStatus: "success", condition: { source: "decision", equals: "product_yes" }, toStepId: "persist-detection-log", finalStatus: null },
    { transitionId: "ask-product-presence:failed", fromStepId: "ask-product-presence", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "ask-product-presence:review", fromStepId: "ask-product-presence", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "persist-detection-log:success", fromStepId: "persist-detection-log", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: "finalize-mission", finalStatus: null },
    { transitionId: "persist-detection-log:failed", fromStepId: "persist-detection-log", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "persist-detection-log:review", fromStepId: "persist-detection-log", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null },
    { transitionId: "request-human-review:review", fromStepId: "request-human-review", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: null, finalStatus: "review_required" },
    { transitionId: "finalize-mission:success", fromStepId: "finalize-mission", onStatus: "success", condition: { source: "status", equals: "success" }, toStepId: null, finalStatus: "completed" },
    { transitionId: "finalize-mission:failed", fromStepId: "finalize-mission", onStatus: "failed", condition: { source: "status", equals: "failed" }, toStepId: null, finalStatus: "failed" },
    { transitionId: "finalize-mission:review", fromStepId: "finalize-mission", onStatus: "review_required", condition: { source: "status", equals: "review_required" }, toStepId: "request-human-review", finalStatus: null }
  ],
  failureBranches: ["detect-feed-ready:failed", "capture-video-viewport:failed", "ask-product-presence:failed", "persist-detection-log:failed", "finalize-mission:failed"],
  reviewBranches: ["detect-feed-ready:review", "capture-video-viewport:review", "ask-product-presence:review", "persist-detection-log:review", "request-human-review:review", "finalize-mission:review"],
  finalStates: ["completed", "failed", "review_required"],
  forbiddenDirectCalls: ["PlatformAdapter", "EvidenceStoreService", "local-ai-decision", "OpenAbilityGroup"],
  sequencePolicy: { maxHops: 8, maxRetriesPerStep: 1, loopDecisionOnLimit: "review_required", branchPolicy: "allow_review_handoff" }
});
