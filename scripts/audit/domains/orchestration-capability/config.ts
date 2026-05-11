export const DOMAIN = "orchestration-capability";
export const CAPABILITY_ROOT = "src/capabilities/orchestration";
export const MAX_FILE_COUNT = 25;
export const EXPECTED_ABILITY_GROUP_ID = "orchestration";
export const EXPECTED_CHILD_CAPABILITY_COUNT = 7;

export const FORBIDDEN_FIELD_NAMES = [
  "mapId",
  "currentRoundIndex",
  "activeTaskRunId",
  "currentStepId",
  "RuntimePlan",
  "routePlan",
  "videoVisitId",
] as const;

export const FORBIDDEN_MODULE_NAMES = [
  "ai-action-plan-decoder",
  "orchestration-executor",
  "round-runner",
  "step-runner",
] as const;
