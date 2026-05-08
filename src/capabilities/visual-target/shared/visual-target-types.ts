import { createHash } from "node:crypto";

const VISUAL_TARGET_ABILITY_GROUP_ID = "visual-target" as const;

const VISUAL_TARGET_CHILD_CAPABILITY_IDS = [
  "observe-like-button",
  "observe-save-button",
  "observe-comments-button",
  "observe-next-item-target-candidate",
  "observe-comments-panel",
  "observe-close-comments-button",
  "observe-not-interested-button",
  "observe-next-video-region",
  "observe-metric-like-count",
  "observe-metric-comment-count",
] as const;

const VISUAL_TARGET_STATUSES = ["success", "failed", "review_required"] as const;

const VISUAL_TARGET_TYPES = [
  "like_button",
  "save_button",
  "comments_button",
  "next_item_target_candidate",
  "comments_panel",
  "close_comments_button",
  "not_interested_button",
  "next_video_region",
  "metric_like_count",
  "metric_comment_count",
] as const;

const VISUAL_TARGET_NATURES = ["action", "region", "metric"] as const;

const VISUAL_TARGET_CANDIDATE_KINDS = ["ai_candidate"] as const;

const VISUAL_TARGET_COORDINATE_SPACES = [
  "browser_viewport",
  "desktop_screen",
  "source_image",
  "contact_sheet",
  "ai_input",
] as const;

const VISUAL_TARGET_SCREENSHOT_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_AI_DECISIONS = ["allow", "review_required", "block", "not_required"] as const;
const VISUAL_TARGET_PAGE_STATE_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_COORDINATE_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_TARGET_TYPE_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_SELECTION_DECISIONS = ["selected", "review_required", "no_candidate"] as const;
const VISUAL_TARGET_AMBIGUITY_DECISIONS = ["clear", "review_required", "block"] as const;
const VISUAL_TARGET_OUTPUT_BOUNDARY_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_CRITICAL_DATA_QUALITY_DECISIONS = ["clear", "review_required", "block"] as const;
const VISUAL_TARGET_PAYLOAD_BUDGET_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_SOURCE_BINDING_DECISIONS = ["allow", "review_required", "block"] as const;
const VISUAL_TARGET_GEOMETRY_HANDOFF_DECISIONS = ["required", "optional", "forbidden"] as const;

function normalizeVisualTargetParts(parts: readonly unknown[]): unknown[] {
  return parts.map((part) => (part === undefined ? null : part));
}

function hashVisualTargetPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function buildStableVisualTargetRef(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${hashVisualTargetPayload(normalizeVisualTargetParts(parts)).slice(0, 16)}`;
}

export { VISUAL_TARGET_ABILITY_GROUP_ID, VISUAL_TARGET_CHILD_CAPABILITY_IDS, VISUAL_TARGET_STATUSES, VISUAL_TARGET_TYPES, VISUAL_TARGET_NATURES, VISUAL_TARGET_CANDIDATE_KINDS, VISUAL_TARGET_COORDINATE_SPACES, VISUAL_TARGET_SCREENSHOT_DECISIONS, VISUAL_TARGET_AI_DECISIONS, VISUAL_TARGET_PAGE_STATE_DECISIONS, VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS, VISUAL_TARGET_COORDINATE_DECISIONS, VISUAL_TARGET_TARGET_TYPE_DECISIONS, VISUAL_TARGET_SELECTION_DECISIONS, VISUAL_TARGET_AMBIGUITY_DECISIONS, VISUAL_TARGET_OUTPUT_BOUNDARY_DECISIONS, VISUAL_TARGET_CRITICAL_DATA_QUALITY_DECISIONS, VISUAL_TARGET_PAYLOAD_BUDGET_DECISIONS, VISUAL_TARGET_SOURCE_BINDING_DECISIONS, VISUAL_TARGET_GEOMETRY_HANDOFF_DECISIONS, normalizeVisualTargetParts, hashVisualTargetPayload, buildStableVisualTargetRef };
