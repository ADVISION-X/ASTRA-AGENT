import type { RoutePlan } from "./route-plan.schema.js";

export const PRODUCT_DISCOVERY_ROUTE_PLAN_PRODUCT_PRESENCE_STEPS: RoutePlan["steps"] = [
  {
    stepId: "observe-current-video-page-state",
    capabilityId: "orchestration",
    childCapabilityId: "observe-video-surface",
    stepKind: "ability",
    targetAbilityGroupId: "page-state",
    inputRefs: ["screenshotEvidenceRef", "targetUrl", "targetTitle"],
    outputRefPolicy: { storeAs: ["pageStateRef"] },
    promptContractId: null,
  },
  {
    stepId: "capture-current-video-viewport",
    capabilityId: "orchestration",
    childCapabilityId: "capture-browser-viewport",
    stepKind: "ability",
    targetAbilityGroupId: "screenshot",
    inputRefs: ["targetUrl", "targetTitle", "pageStateRef"],
    outputRefPolicy: { storeAs: ["screenshotEvidenceRef"] },
    promptContractId: null,
  },
  {
    stepId: "prepare-current-video-ai-input",
    capabilityId: "orchestration",
    childCapabilityId: "prepare-ai-input",
    stepKind: "ability",
    targetAbilityGroupId: "screenshot",
    inputRefs: ["screenshotEvidenceRef"],
    outputRefPolicy: { storeAs: ["promptInputRef"] },
    promptContractId: null,
  },
  {
    stepId: "judge-seeding-video",
    capabilityId: "orchestration",
    childCapabilityId: "product-presence-judgment",
    stepKind: "ai",
    targetAbilityGroupId: "ai",
    inputRefs: ["promptInputRef"],
    outputRefPolicy: { storeAs: ["aiResultRef", "productPresenceAiResultRef"] },
    promptContractId: "vision.productPresence.v1",
  },
];