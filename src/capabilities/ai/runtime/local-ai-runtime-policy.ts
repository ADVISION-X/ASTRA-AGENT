import type { ParsedAiAbilityInput } from "../contract.js";

export const AI_LOCAL_RUNTIME_POLICY = {
  maxConcurrentRuns: 1,
  circuitFailureThreshold: 3,
  circuitOpenMs: 60_000,
  lateResultPolicy: "discard_after_abort",
} as const;

export const AI_RUNTIME_COMPLETION_GRACE_MS = 30_000;

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

export const MAX_AI_RUNTIME_TIMEOUT_MS = Math.max(...Object.values(AI_RUNTIME_TIMEOUT_BY_TASK_MS));

export const AI_TRANSPORT_TIMEOUT_MS = MAX_AI_RUNTIME_TIMEOUT_MS + AI_RUNTIME_COMPLETION_GRACE_MS;

export const resolveAiRuntimeTimeoutMs = (taskType: ParsedAiAbilityInput["taskType"]): number =>
  AI_RUNTIME_TIMEOUT_BY_TASK_MS[taskType];

export const resolveAiDispatchTimeoutMs = (taskType: ParsedAiAbilityInput["taskType"]): number =>
  resolveAiRuntimeTimeoutMs(taskType) + AI_RUNTIME_COMPLETION_GRACE_MS;