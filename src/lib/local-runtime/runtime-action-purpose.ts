import type { EvidencePacketActionPurpose } from "../../types/evidence-packet.js";
import type { PlatformActionType } from "../../types/platform-action.js";
import type { RoundLifecycleStep } from "../../types/evidence-packet.js";

const ACTION_PURPOSE_BY_TYPE: Record<PlatformActionType, EvidencePacketActionPurpose> = {
  open_feed: "initialize_discovery",
  observe_current_video: "observe_video_context",
  capture_video_region: "collect_video_evidence",
  click_not_interested: "reduce_non_product_recommendations",
  like_or_save_candidate: "recommendation_tuning_marker",
  open_comments: "collect_comment_evidence",
  capture_comment_region: "collect_comment_evidence",
  continue_next: "continue_discovery",
  scroll: "continue_discovery",
  wait: "runtime_support",
  close: "runtime_support",
};

export const deriveActionPurpose = (actionType: PlatformActionType): EvidencePacketActionPurpose => ACTION_PURPOSE_BY_TYPE[actionType];

const ROUND_STEP_BY_ACTION_TYPE: Record<PlatformActionType, RoundLifecycleStep> = {
  open_feed: "open_target_page",
  observe_current_video: "identify_current_video",
  capture_video_region: "screenshot_video_area",
  click_not_interested: "click_not_interested",
  like_or_save_candidate: "like_or_save_marker",
  open_comments: "open_comments",
  capture_comment_region: "screenshot_comments",
  continue_next: "click_next_video",
  scroll: "click_next_video",
  wait: "wait_video_stable",
  close: "stop",
};

export const derivePlatformActionStep = (actionType: PlatformActionType): RoundLifecycleStep => ROUND_STEP_BY_ACTION_TYPE[actionType];

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
  click_next_video: "continue_discovery",
  record_skip_reason: "runtime_support",
  record_round_complete: "runtime_support",
  review_required: "finalize_failed_or_review_record",
  stop: "runtime_support",
};

export const deriveRoundStepActionPurpose = (step: RoundLifecycleStep): EvidencePacketActionPurpose => ACTION_PURPOSE_BY_STEP[step];