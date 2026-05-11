const AI_ABILITY_GROUP_ID = "ai";

const AI_CHILD_CAPABILITY_IDS = [
  "local-vision-ai",
  "local-text-ai",
  "local-ocr-ai",
  "internal-schema-validator",
  "paid-vision-ai",
  "paid-analysis-ai",
  "future-api-ai",
] as const;

const AI_TASK_TYPES = [
  "page_preparation_judgment",
  "product_presence_judgment",
  "visual_observation",
  "visual_mission_action_plan",
  "visual_target_candidate_analysis",
  "ocr_cleanup",
  "comment_signal_summary",
  "product_signal_summary",
  "evidence_packet_analysis",
  "schema_validation_only",
] as const;

const AI_PROVIDER_KINDS = ["local", "paid", "future", "internal"] as const;
const AI_MODEL_ROLES = ["vision", "ocr", "commentUnderstanding", "productSignal", "schemaValidator", "multi-role", "future"] as const;
const AI_INPUT_MODALITIES = ["image_collection", "text_blocks", "structured_record", "mixed", "none"] as const;
const AI_EXECUTION_STATUSES = ["success", "failed", "review_required"] as const;
const AI_SCHEMA_VALIDATION_STATUSES = ["valid", "invalid", "not_applicable"] as const;
const AI_OUTPUT_AUTHORITIES = ["authoritative", "non_authoritative"] as const;
const AI_CHILD_CAPABILITY_STATUSES = ["ready", "degraded", "unavailable", "disabled_by_policy"] as const;

const AI_PROVIDER_POLICY_DECISIONS = ["allow", "review_required", "blocked", "disabled"] as const;
const AI_DATA_POLICY_DECISIONS = ["allow", "review_required", "blocked", "not_applicable"] as const;
const AI_COST_POLICY_DECISIONS = ["allow", "review_required", "blocked", "not_applicable"] as const;
const AI_SAFETY_POLICY_DECISIONS = ["allow", "review_required", "blocked"] as const;
const AI_SCHEMA_DECISIONS = ["resolved", "review_required", "blocked"] as const;
const AI_QUALITY_DECISIONS = ["pass", "review_required", "blocked"] as const;
const AI_OUTPUT_BOUNDARY_DECISIONS = ["allow", "review_required", "blocked"] as const;
const AI_DISABLED_PROVIDER_DECISIONS = ["not_applicable", "disabled"] as const;

function buildStableAiRef(prefix: string, parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((part) => (part === null || part === undefined || part.length === 0 ? "none" : part))
    .join(":")
    .replace(/[^a-zA-Z0-9:_-]+/g, "_");
  return `${prefix}:${normalized}`;
}

export {
  AI_ABILITY_GROUP_ID,
  AI_CHILD_CAPABILITY_IDS,
  AI_TASK_TYPES,
  AI_PROVIDER_KINDS,
  AI_MODEL_ROLES,
  AI_INPUT_MODALITIES,
  AI_EXECUTION_STATUSES,
  AI_SCHEMA_VALIDATION_STATUSES,
  AI_OUTPUT_AUTHORITIES,
  AI_CHILD_CAPABILITY_STATUSES,
  AI_PROVIDER_POLICY_DECISIONS,
  AI_DATA_POLICY_DECISIONS,
  AI_COST_POLICY_DECISIONS,
  AI_SAFETY_POLICY_DECISIONS,
  AI_SCHEMA_DECISIONS,
  AI_QUALITY_DECISIONS,
  AI_OUTPUT_BOUNDARY_DECISIONS,
  AI_DISABLED_PROVIDER_DECISIONS,
  buildStableAiRef,
};
