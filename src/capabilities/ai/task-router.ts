import type { AiChildCapabilityId, AiTaskType } from "./contract.js";

const AI_TASK_ROUTING: Record<AiTaskType, AiChildCapabilityId | null> = {
  page_preparation_judgment: "local-vision-ai",
  product_presence_judgment: "local-vision-ai",
  visual_observation: "local-vision-ai",
  visual_mission_action_plan: "local-vision-ai",
  visual_target_candidate_analysis: "local-vision-ai",
  ocr_cleanup: "local-ocr-ai",
  comment_signal_summary: "local-text-ai",
  product_signal_summary: "local-text-ai",
  evidence_packet_analysis: "paid-analysis-ai",
  map_authoring: "paid-analysis-ai",
  schema_validation_only: "internal-schema-validator",
};

export function routeAiTaskToChild(taskType: AiTaskType): AiChildCapabilityId | null {
  return AI_TASK_ROUTING[taskType] ?? null;
}

export function listAiTaskRoutes(): Record<AiTaskType, AiChildCapabilityId | null> {
  return { ...AI_TASK_ROUTING };
}
