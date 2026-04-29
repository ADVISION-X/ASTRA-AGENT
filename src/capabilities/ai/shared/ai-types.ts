export const AI_ABILITY_GROUP_ID = "ai";

export const AI_CHILD_CAPABILITY_IDS = [
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

export const AI_TASK_TYPES = [
  "product_presence_judgment",
  "visual_observation",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "schema_validation_only",
] as const;

export const AI_PROVIDER_KINDS = ["local", "paid", "future", "internal"] as const;
export const AI_MODEL_ROLES = ["vision", "ocr", "commentUnderstanding", "productSignal", "schemaValidator", "multi-role", "future"] as const;
export const AI_INPUT_MODALITIES = ["image_collection", "text_blocks", "structured_record", "mixed", "none"] as const;
export const AI_EXECUTION_STATUSES = ["success", "failed", "review_required"] as const;
export const AI_SCHEMA_VALIDATION_STATUSES = ["valid", "invalid", "not_applicable"] as const;
export const AI_OUTPUT_AUTHORITIES = ["authoritative", "non_authoritative"] as const;
export const AI_CHILD_CAPABILITY_STATUSES = ["ready", "degraded", "unavailable", "disabled_by_policy"] as const;

export const AI_PROVIDER_POLICY_DECISIONS = ["allow", "review_required", "blocked", "disabled"] as const;
export const AI_DATA_POLICY_DECISIONS = ["allow", "review_required", "blocked", "not_applicable"] as const;
export const AI_COST_POLICY_DECISIONS = ["allow", "review_required", "blocked", "not_applicable"] as const;
export const AI_SAFETY_POLICY_DECISIONS = ["allow", "review_required", "blocked"] as const;
export const AI_SCHEMA_DECISIONS = ["resolved", "review_required", "blocked"] as const;
export const AI_QUALITY_DECISIONS = ["pass", "review_required", "blocked"] as const;
export const AI_OUTPUT_BOUNDARY_DECISIONS = ["allow", "review_required", "blocked"] as const;
export const AI_DISABLED_PROVIDER_DECISIONS = ["not_applicable", "disabled"] as const;

export function buildStableAiRef(prefix: string, parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((part) => (part === null || part === undefined || part.length === 0 ? "none" : part))
    .join(":")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_");
  return `${prefix}:${normalized}`;
}
