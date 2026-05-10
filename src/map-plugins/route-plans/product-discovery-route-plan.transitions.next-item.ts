import type { RoutePlan } from "./route-plan.schema.js";

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
    toStepId: "observe-current-video-page-state",
    finalStatus: null,
  },
  {
    transitionId: "press-next-video-key:failed",
    fromStepId: "press-next-video-key",
    onStatus: "failed",
    toStepId: "observe-current-video-page-state",
    finalStatus: null,
  },
  {
    transitionId: "press-next-video-key:review_required",
    fromStepId: "press-next-video-key",
    onStatus: "review_required",
    toStepId: "observe-current-video-page-state",
    finalStatus: null,
  },
];
