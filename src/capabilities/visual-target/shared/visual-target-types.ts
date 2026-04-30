import { createHash } from "node:crypto";

export const VISUAL_TARGET_ABILITY_GROUP_ID = "visual-target" as const;

export const VISUAL_TARGET_CHILD_CAPABILITY_IDS = [
  "detect-like-button",
  "detect-save-button",
  "detect-comments-button",
  "detect-comments-panel",
  "detect-close-comments-button",
  "detect-not-interested-button",
  "detect-next-video-region",
  "detect-metric-like-count",
  "detect-metric-comment-count",
] as const;

export const VISUAL_TARGET_STATUSES = ["success", "failed", "review_required"] as const;

export const VISUAL_TARGET_TYPES = [
  "like_button",
  "save_button",
  "comments_button",
  "comments_panel",
  "close_comments_button",
  "not_interested_button",
  "next_video_region",
  "metric_like_count",
  "metric_comment_count",
] as const;

export const VISUAL_TARGET_NATURES = ["action", "region", "metric"] as const;

export const VISUAL_TARGET_CANDIDATE_KINDS = ["ai_candidate", "heuristic_profile", "operator_manual"] as const;

export const VISUAL_TARGET_COORDINATE_SPACES = [
  "browser_viewport",
  "desktop_screen",
  "source_image",
  "contact_sheet",
  "ai_input",
] as const;

export const VISUAL_TARGET_SCREENSHOT_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_AI_DECISIONS = ["allow", "review_required", "block", "not_required"] as const;
export const VISUAL_TARGET_PAGE_STATE_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_CANDIDATE_SOURCE_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_COORDINATE_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_TARGET_TYPE_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_SELECTION_DECISIONS = ["selected", "review_required", "no_candidate"] as const;
export const VISUAL_TARGET_AMBIGUITY_DECISIONS = ["clear", "review_required", "block"] as const;
export const VISUAL_TARGET_OUTPUT_BOUNDARY_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_CRITICAL_DATA_QUALITY_DECISIONS = ["clear", "review_required", "block"] as const;
export const VISUAL_TARGET_PAYLOAD_BUDGET_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_SOURCE_BINDING_DECISIONS = ["allow", "review_required", "block"] as const;
export const VISUAL_TARGET_GEOMETRY_HANDOFF_DECISIONS = ["required", "optional", "forbidden"] as const;

export function normalizeVisualTargetParts(parts: readonly unknown[]): unknown[] {
  return parts.map((part) => (part === undefined ? null : part));
}

export function hashVisualTargetPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function buildStableVisualTargetRef(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${hashVisualTargetPayload(normalizeVisualTargetParts(parts)).slice(0, 16)}`;
}