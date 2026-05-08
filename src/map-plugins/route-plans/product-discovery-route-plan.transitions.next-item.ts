import type { RoutePlan } from "./route-plan.schema.js";
import {
  NEXT_ITEM_ADVANCED_ROUTE_LABEL,
  NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL,
} from "./product-discovery-route-plan.constants.js";

export const PRODUCT_DISCOVERY_ROUTE_PLAN_NEXT_ITEM_TRANSITIONS: RoutePlan["transitions"] = [
  {
    transitionId: "observe-next-item-page-state:success",
    fromStepId: "observe-next-item-page-state",
    onStatus: "success",
    toStepId: "press-next-video-key",
    finalStatus: null,
  },
  {
    transitionId: "observe-next-item-page-state:failed",
    fromStepId: "observe-next-item-page-state",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: "press-next-video-key:success",
    fromStepId: "press-next-video-key",
    onStatus: "success",
    toStepId: "capture-next-item-verification-viewport",
    finalStatus: null,
  },
  {
    transitionId: "press-next-video-key:failed",
    fromStepId: "press-next-video-key",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: "capture-next-item-verification-viewport:success",
    fromStepId: "capture-next-item-verification-viewport",
    onStatus: "success",
    toStepId: "prepare-next-item-verification-ai-input",
    finalStatus: null,
  },
  {
    transitionId: "capture-next-item-verification-viewport:failed",
    fromStepId: "capture-next-item-verification-viewport",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: "prepare-next-item-verification-ai-input:success",
    fromStepId: "prepare-next-item-verification-ai-input",
    onStatus: "success",
    toStepId: "verify-next-item-advanced",
    finalStatus: null,
  },
  {
    transitionId: "prepare-next-item-verification-ai-input:failed",
    fromStepId: "prepare-next-item-verification-ai-input",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: `verify-next-item-advanced:${NEXT_ITEM_ADVANCED_ROUTE_LABEL}`,
    fromStepId: "verify-next-item-advanced",
    onStatus: "success",
    toStepId: "judge-seeding-video",
    finalStatus: null,
  },
  {
    transitionId: `verify-next-item-advanced:${NEXT_ITEM_NOT_ADVANCED_ROUTE_LABEL}`,
    fromStepId: "verify-next-item-advanced",
    onStatus: "success",
    toStepId: "capture-current-video-viewport",
    finalStatus: null,
  },
  {
    transitionId: "verify-next-item-advanced:failed",
    fromStepId: "verify-next-item-advanced",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
];