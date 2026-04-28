import type { AgentSkillCategory } from "../../types/agent-skill.js";
import type { RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { StructuredActionPurpose, StructuredActionType } from "../../types/structured-log.js";

const RUNTIME_STEP_TO_SKILL_ID: Partial<Record<RoundLifecycleStep, string>> = {
  task_start: "write_structured_runtime_event",
  open_target_page: "open_target_page",
  detect_login_or_safety: "detect_captcha_or_safety",
  wait_feed_ready: "wait_feed_ready",
  single_video_round_start: "update_runtime_snapshot",
  wait_video_stable: "wait_video_stable",
  identify_current_video: "identify_current_video",
  calibrate_geometry: "verify_geometry_still_valid",
  screenshot_video_area: "detect_video_area",
  record_video_evidence: "write_data_quality_flags",
  ask_ai_product_presence: "ask_product_presence",
  validate_ai_output: "validate_ai_schema",
  branch: "branch_uncertain",
  collect_pre_action_metrics: "detect_metric_like_count",
  like_or_save_marker: "click_like_or_save_marker",
  open_comments: "click_open_comments",
  screenshot_comments: "detect_comment_panel",
  extract_visible_comments: "detect_comment_panel",
  summarize_comment_signals: "update_runtime_snapshot",
  create_pending_candidate: "finalize_evidence_packet",
  create_video_only_pending_candidate: "finalize_evidence_packet",
  finalize_evidence_packet: "finalize_evidence_packet",
  finalize_browse_ledger: "finalize_browse_ledger",
  finalize_failed_or_review_record: "write_data_quality_flags",
  decide_negative_action: "branch_product_no",
  click_not_interested: "click_not_interested",
  scroll_next_video: "scroll_next_video",
  record_skip_reason: "write_data_quality_flags",
  record_round_complete: "update_runtime_snapshot",
  review_required: "update_runtime_snapshot",
  stop: "update_runtime_snapshot",
};

const RUNTIME_EVENT_TYPE_TO_SKILL_ID: Partial<Record<string, string>> = {
  sample_video_frames_started: "sample_frame_3s",
  multi_frame_capture_completed: "validate_multiframe_evidence",
  create_contact_sheet_completed: "create_contact_sheet",
  step_timeout: "write_structured_runtime_event",
};

const ACTION_STEP_TO_SKILL_ID: Partial<Record<StructuredActionType, string>> = {
  open_target_page: "open_target_page",
  detect_login_or_safety: "detect_login_state",
  wait_feed_ready: "wait_feed_ready",
  wait_video_stable: "wait_video_stable",
  identify_current_video: "identify_current_video",
  calibrate_geometry: "verify_geometry_still_valid",
  screenshot_video_area: "detect_video_area",
  record_video_evidence: "write_data_quality_flags",
  ask_ai_product_presence: "ask_product_presence",
  validate_ai_output: "validate_ai_schema",
  branch: "branch_uncertain",
  collect_pre_action_metrics: "detect_metric_like_count",
  like_or_save_marker: "click_like_or_save_marker",
  open_comments: "click_open_comments",
  screenshot_comments: "detect_comment_panel",
  extract_visible_comments: "detect_comment_panel",
  summarize_comment_signals: "update_runtime_snapshot",
  create_pending_candidate: "finalize_evidence_packet",
  create_video_only_pending_candidate: "finalize_evidence_packet",
  finalize_evidence_packet: "finalize_evidence_packet",
  finalize_browse_ledger: "finalize_browse_ledger",
  finalize_failed_or_review_record: "write_data_quality_flags",
  decide_negative_action: "branch_product_no",
  click_not_interested: "click_not_interested",
  scroll_next_video: "scroll_next_video",
  record_skip_reason: "write_data_quality_flags",
  record_round_complete: "update_runtime_snapshot",
  review_required: "update_runtime_snapshot",
  stop: "update_runtime_snapshot",
  task_start: "write_structured_runtime_event",
  single_video_round_start: "update_runtime_snapshot",
};

const ACTION_TYPE_TO_SKILL_ID: Partial<Record<string, string>> = {
  open_feed: "open_target_page",
  observe_current_video: "identify_current_video",
  capture_video_region: "detect_video_area",
  click_not_interested: "click_not_interested",
  like_or_save_candidate: "click_like_or_save_marker",
  open_comments: "click_open_comments",
  capture_comment_region: "detect_comment_panel",
  continue_next: "scroll_next_video",
  scroll: "scroll_next_video",
};

const ACTION_PURPOSE_TO_SKILL_ID: Partial<Record<StructuredActionPurpose, string>> = {
  initialize_discovery: "open_target_page",
  detect_page_safety: "detect_login_state",
  wait_for_feed: "wait_feed_ready",
  wait_for_video_stability: "wait_video_stable",
  identify_video: "identify_current_video",
  calibrate_geometry: "verify_geometry_still_valid",
  collect_video_evidence: "detect_video_area",
  ask_product_presence: "ask_product_presence",
  collect_pre_action_metrics: "detect_metric_like_count",
  recommendation_tuning_marker: "click_like_or_save_marker",
  collect_comment_evidence: "click_open_comments",
  reduce_non_product_recommendations: "click_not_interested",
  continue_discovery: "scroll_next_video",
  finalize_evidence_packet: "finalize_evidence_packet",
  finalize_browse_ledger: "finalize_browse_ledger",
  finalize_failed_or_review_record: "write_data_quality_flags",
  observe_video_context: "detect_video_orientation",
  runtime_support: "update_runtime_snapshot",
};

const SKILL_CATEGORY_BY_ID: Partial<Record<string, AgentSkillCategory>> = {
  open_target_page: "browser_session",
  detect_login_state: "browser_session",
  detect_captcha_or_safety: "browser_session",
  wait_feed_ready: "video_perception",
  wait_video_stable: "video_perception",
  identify_current_video: "video_perception",
  detect_video_orientation: "video_perception",
  detect_video_area: "screenshot",
  verify_geometry_still_valid: "coordinate_action",
  ask_product_presence: "local_ai_decision",
  validate_ai_schema: "local_ai_decision",
  detect_metric_like_count: "coordinate_action",
  click_like_or_save_marker: "coordinate_action",
  click_open_comments: "coordinate_action",
  detect_comment_panel: "screenshot",
  click_not_interested: "coordinate_action",
  scroll_next_video: "coordinate_action",
  finalize_evidence_packet: "forensics_persistence",
  finalize_browse_ledger: "forensics_persistence",
  write_data_quality_flags: "forensics_persistence",
  update_runtime_snapshot: "forensics_persistence",
  write_structured_runtime_event: "forensics_persistence",
  branch_uncertain: "local_ai_decision",
  branch_product_no: "local_ai_decision",
  sample_frame_3s: "multi_frame_evidence",
  validate_multiframe_evidence: "multi_frame_evidence",
  create_contact_sheet: "multi_frame_evidence",
};

export function resolveRuntimeStepSkillId(step: RoundLifecycleStep, eventType?: string): string {
  if (eventType && RUNTIME_EVENT_TYPE_TO_SKILL_ID[eventType]) {
    return RUNTIME_EVENT_TYPE_TO_SKILL_ID[eventType] ?? "update_runtime_snapshot";
  }

  if (step === "branch") {
    return "branch_uncertain";
  }

  return RUNTIME_STEP_TO_SKILL_ID[step] ?? "update_runtime_snapshot";
}

export function resolveActionSkillId(input: {
  step: StructuredActionType;
  actionType?: string;
  actionPurpose: StructuredActionPurpose;
}): string {
  return ACTION_TYPE_TO_SKILL_ID[input.actionType ?? ""]
    ?? ACTION_STEP_TO_SKILL_ID[input.step]
    ?? ACTION_PURPOSE_TO_SKILL_ID[input.actionPurpose]
    ?? "safe_click_visual_target";
}

export function resolveAgentSkillCategory(skillId: string): AgentSkillCategory {
  return SKILL_CATEGORY_BY_ID[skillId] ?? "forensics_persistence";
}