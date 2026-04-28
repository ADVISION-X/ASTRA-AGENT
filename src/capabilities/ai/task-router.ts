import type { AiChildCapabilityId, AiTaskType } from "./contract.js";

const AI_TASK_ROUTING: Record<AiTaskType, AiChildCapabilityId> = {
  product_presence_judgment: "local-vision-ai",
  visual_observation: "local-vision-ai",
  visual_target_candidate_analysis: "local-vision-ai",
  ocr_cleanup: "local-ocr-ai",
  comment_signal_summary: "local-text-ai",
  product_signal_summary: "local-text-ai",
  evidence_packet_analysis: "paid-analysis-ai",
  schema_validation_only: "local-text-ai",
};

export function routeAiTaskToChild(taskType: AiTaskType): AiChildCapabilityId {
  return AI_TASK_ROUTING[taskType];
}

export function getAiTaskRoutingTable(): Record<AiTaskType, AiChildCapabilityId> {
  return { ...AI_TASK_ROUTING };
}