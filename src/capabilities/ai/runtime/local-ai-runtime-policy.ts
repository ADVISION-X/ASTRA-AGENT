import type { ParsedAiAbilityInput } from "../contract.js";

export const AI_LOCAL_RUNTIME_POLICY = {
  maxConcurrentRuns: 1,
  circuitFailureThreshold: 3,
  circuitOpenMs: 60_000,
  lateResultPolicy: "discard_after_abort",
} as const;

const AI_RUNTIME_TIMEOUT_BY_TASK_MS: Record<ParsedAiAbilityInput["taskType"], number> = {
  product_presence_judgment: 45_000,
  visual_observation: 45_000,
  visual_target_candidate_analysis: 45_000,
  ocr_cleanup: 20_000,
  comment_signal_summary: 30_000,
  product_signal_summary: 30_000,
  evidence_packet_analysis: 30_000,
  map_authoring: 60_000,
  schema_validation_only: 5_000,
};

export const resolveAiRuntimeTimeoutMs = (taskType: ParsedAiAbilityInput["taskType"]): number =>
  AI_RUNTIME_TIMEOUT_BY_TASK_MS[taskType];