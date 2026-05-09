import type { RoutePlan } from "./route-plan.schema.js";
import {
  PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL,
  PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL,
} from "./product-discovery-route-plan.constants.js";
import {
  STARTUP_PREPARATION_READY_ROUTE_LABEL,
} from "../shared/startup-preparation.constants.js";

export const PRODUCT_DISCOVERY_ROUTE_PLAN_PRODUCT_PRESENCE_TRANSITIONS: RoutePlan["transitions"] = [
  {
    transitionId: `startup-preparation:${STARTUP_PREPARATION_READY_ROUTE_LABEL}`,
    fromStepId: "startup-preparation",
    onStatus: "success",
    toStepId: "observe-current-video-page-state",
    finalStatus: null,
  },
  {
    transitionId: "observe-current-video-page-state:success",
    fromStepId: "observe-current-video-page-state",
    onStatus: "success",
    toStepId: "capture-current-video-viewport",
    finalStatus: null,
  },
  {
    transitionId: "observe-current-video-page-state:failed",
    fromStepId: "observe-current-video-page-state",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: "capture-current-video-viewport:success",
    fromStepId: "capture-current-video-viewport",
    onStatus: "success",
    toStepId: "prepare-current-video-ai-input",
    finalStatus: null,
  },
  {
    transitionId: "capture-current-video-viewport:failed",
    fromStepId: "capture-current-video-viewport",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: "prepare-current-video-ai-input:success",
    fromStepId: "prepare-current-video-ai-input",
    onStatus: "success",
    toStepId: "judge-seeding-video",
    finalStatus: null,
  },
  {
    transitionId: "prepare-current-video-ai-input:failed",
    fromStepId: "prepare-current-video-ai-input",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
  {
    transitionId: `judge-seeding-video:${PRODUCT_DISCOVERY_POSITIVE_ROUTE_LABEL}`,
    fromStepId: "judge-seeding-video",
    onStatus: "success",
    toStepId: "observe-comments-entry-page-state",
    finalStatus: null,
  },
  {
    transitionId: `judge-seeding-video:${PRODUCT_DISCOVERY_NEGATIVE_ROUTE_LABEL}`,
    fromStepId: "judge-seeding-video",
    onStatus: "success",
    toStepId: "observe-next-item-page-state",
    finalStatus: null,
  },
  {
    transitionId: "judge-seeding-video:finish-current-video",
    fromStepId: "judge-seeding-video",
    onStatus: "success",
    toStepId: "finalize-mission",
    finalStatus: null,
  },
  {
    transitionId: "judge-seeding-video:stop-task",
    fromStepId: "judge-seeding-video",
    onStatus: "success",
    toStepId: "finalize-mission",
    finalStatus: null,
  },
  {
    transitionId: "judge-seeding-video:failed",
    fromStepId: "judge-seeding-video",
    onStatus: "failed",
    toStepId: null,
    finalStatus: "failed",
  },
];