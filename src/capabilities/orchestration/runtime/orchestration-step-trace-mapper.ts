import type {
  EvidencePacketActionPurpose,
  RoundLifecycleStep,
} from "../../../types/evidence-packet.js";

import type { OperationalStep } from "./step-dispatch-shared.js";

const STEP_BY_STEP_ID: Record<string, RoundLifecycleStep> = {
  "normalize-comments-target": "open_comments",
  "click-comments-button": "open_comments",
  "verify-comments-open": "open_comments",
  "capture-comments-panel": "screenshot_comments",
  "observe-next-video-region": "scroll_next_video",
  "normalize-next-video-region": "scroll_next_video",
  "scroll-next-video": "scroll_next_video",
  "persist-seeding-candidate-record": "create_pending_candidate",
};

const STEP_BY_CHILD_CAPABILITY: Record<string, RoundLifecycleStep> = {
  "open-facebook": "open_target_page",
  "open-tiktok": "open_target_page",
  "observe-login-surface": "detect_login_or_safety",
  "observe-safety-surface": "detect_login_or_safety",
  "observe-feed-surface": "wait_feed_ready",
  "capture-browser-viewport": "screenshot_video_area",
  "prepare-ai-input": "record_video_evidence",
  "product-presence-judgment": "ask_ai_product_presence",
  "comment-intent-analysis": "summarize_comment_signals",
  "write-evidence-record": "create_pending_candidate",
};

const VERIFIED_ACTION_STEP_BY_CHILD_CAPABILITY: Record<string, RoundLifecycleStep> = {
  "observe-comments-panel-open-attempt": "open_comments",
};

const FALLBACK_STEP_BY_KIND: Partial<Record<OperationalStep["stepKind"], RoundLifecycleStep>> = {
  finalize: "stop",
};

const FALLBACK_STEP_BY_TARGET_ABILITY: Record<string, RoundLifecycleStep> = {
  open: "open_target_page",
  ai: "ask_ai_product_presence",
};

const ACTION_PURPOSE_BY_STEP: Record<RoundLifecycleStep, EvidencePacketActionPurpose> = {
  task_start: "initialize_discovery",
  open_target_page: "initialize_discovery",
  detect_login_or_safety: "detect_page_safety",
  wait_feed_ready: "wait_for_feed",
  single_video_round_start: "observe_video_context",
  wait_video_stable: "wait_for_video_stability",
  identify_current_video: "identify_video",
  calibrate_geometry: "calibrate_geometry",
  screenshot_video_area: "collect_video_evidence",
  record_video_evidence: "collect_video_evidence",
  ask_ai_product_presence: "ask_product_presence",
  validate_ai_output: "ask_product_presence",
  branch: "runtime_support",
  collect_pre_action_metrics: "collect_pre_action_metrics",
  like_or_save_marker: "recommendation_tuning_marker",
  open_comments: "collect_comment_evidence",
  screenshot_comments: "collect_comment_evidence",
  extract_visible_comments: "collect_comment_evidence",
  summarize_comment_signals: "collect_comment_evidence",
  create_pending_candidate: "collect_comment_evidence",
  create_video_only_pending_candidate: "collect_comment_evidence",
  finalize_evidence_packet: "finalize_evidence_packet",
  finalize_browse_ledger: "finalize_browse_ledger",
  finalize_failed_or_review_record: "finalize_failed_or_review_record",
  decide_negative_action: "reduce_non_product_recommendations",
  click_not_interested: "reduce_non_product_recommendations",
  scroll_next_video: "continue_discovery",
  record_skip_reason: "runtime_support",
  record_round_complete: "runtime_support",
  review_required: "finalize_failed_or_review_record",
  stop: "runtime_support",
};

function resolveFallbackRuntimeStep(step: OperationalStep): RoundLifecycleStep {
  const stepKindFallback = FALLBACK_STEP_BY_KIND[step.stepKind];
  if (stepKindFallback) {
    return stepKindFallback;
  }

  if (step.targetAbilityGroupId === "post-action-verification") {
    return VERIFIED_ACTION_STEP_BY_CHILD_CAPABILITY[step.childCapabilityId] ?? "task_start";
  }

  return FALLBACK_STEP_BY_TARGET_ABILITY[step.targetAbilityGroupId ?? ""] ?? "task_start";
}

export function resolveRuntimeStepForOperationalStep(step: OperationalStep): RoundLifecycleStep {
  return (
    STEP_BY_STEP_ID[step.stepId]
    ?? STEP_BY_CHILD_CAPABILITY[step.childCapabilityId]
    ?? resolveFallbackRuntimeStep(step)
  );
}

export function resolveVerifiedActionStep(step: OperationalStep): RoundLifecycleStep | null {
  if (step.targetAbilityGroupId !== "post-action-verification") {
    return null;
  }

  return VERIFIED_ACTION_STEP_BY_CHILD_CAPABILITY[step.childCapabilityId] ?? null;
}

export function resolveRuntimeActionPurpose(step: RoundLifecycleStep): EvidencePacketActionPurpose {
  return ACTION_PURPOSE_BY_STEP[step] ?? "runtime_support";
}
