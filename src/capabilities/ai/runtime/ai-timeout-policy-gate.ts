import type { ParsedAiAbilityInput } from "../contract.js";

const TIMEOUT_BY_TASK_MS: Record<ParsedAiAbilityInput["taskType"], number> = {
  product_presence_judgment: 45_000,
  visual_observation: 45_000,
  visual_target_candidate_analysis: 45_000,
  ocr_cleanup: 20_000,
  comment_signal_summary: 30_000,
  product_signal_summary: 30_000,
  evidence_packet_analysis: 30_000,
  schema_validation_only: 5_000,
};

export function resolveAiTimeoutPolicy(request: ParsedAiAbilityInput): { decision: "allow"; timeoutMs: number; reason: null } {
  return {
    decision: "allow",
    timeoutMs: TIMEOUT_BY_TASK_MS[request.taskType],
    reason: null,
  };
}
