import type { ParsedAiAbilityInput } from "../contract.js";

export const AI_LOCAL_RUNTIME_POLICY = {
  maxConcurrentRuns: 1,
  circuitFailureThreshold: 3,
  circuitOpenMs: 60_000,
  lateResultPolicy: "discard_after_abort",
} as const;

const AI_RUNTIME_TIMEOUT_BY_TASK_MS: Record<ParsedAiAbilityInput["taskType"], number> = {
  page_preparation_judgment: 60_000,
  product_presence_judgment: 60_000,
  visual_observation: 60_000,
  visual_target_candidate_analysis: 60_000,
  ocr_cleanup: 60_000,
  comment_signal_summary: 60_000,
  product_signal_summary: 60_000,
  evidence_packet_analysis: 60_000,
  map_authoring: 60_000,
  schema_validation_only: 60_000,
};

export const resolveAiRuntimeTimeoutMs = (taskType: ParsedAiAbilityInput["taskType"]): number =>
  AI_RUNTIME_TIMEOUT_BY_TASK_MS[taskType];