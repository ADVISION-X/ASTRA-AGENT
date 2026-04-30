import type { AiChildCapabilityId, AiTaskType } from "./contract.js";

const AI_TASK_ROUTING: Record<AiTaskType, AiChildCapabilityId | null> = {
  product_presence_judgment: "local-vision-ai",
  visual_observation: "local-vision-ai",
  visual_target_candidate_analysis: "local-vision-ai",
  ocr_cleanup: "local-ocr-ai",
  comment_signal_summary: "local-text-ai",
  product_signal_summary: "local-text-ai",
  evidence_packet_analysis: null,
  schema_validation_only: "internal-schema-validator",
};

export function routeAiTaskToChild(taskType: AiTaskType): AiChildCapabilityId | null {
  return AI_TASK_ROUTING[taskType];
}

export function listAiTaskRoutes(): Record<AiTaskType, AiChildCapabilityId | null> {
  return { ...AI_TASK_ROUTING };
}
