import type { RoundLifecycleEventStatus, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";

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
  click_next_video: "click_next_video",
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

const resolveRuntimeStepSkillId = (step: RoundLifecycleStep, eventType?: string): string => {
  if (eventType && RUNTIME_EVENT_TYPE_TO_SKILL_ID[eventType]) {
    return RUNTIME_EVENT_TYPE_TO_SKILL_ID[eventType] ?? "update_runtime_snapshot";
  }
  if (step === "branch") {
    return "branch_uncertain";
  }
  return RUNTIME_STEP_TO_SKILL_ID[step] ?? "update_runtime_snapshot";
};

const COMPLETED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  task_start: "task_started",
  single_video_round_start: "single_video_round_started",
  review_required: "review_required",
  stop: "task_stopped",
  branch: "branch_decision_completed",
  record_video_evidence: "record_video_evidence_completed",
};

const ENTERED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  click_next_video: "click_next_video_started",
  wait_video_stable: "next_video_wait_started",
};

export const toStructuredRuntimeEventType = (step: RoundLifecycleStep, status: RoundLifecycleEventStatus): string => {
  if (status === "entered") {
    return ENTERED_EVENT_TYPES[step] ?? `${step}_started`;
  }
  return COMPLETED_EVENT_TYPES[step] ?? `${step}_${status}`;
};

export const toStructuredRuntimeStatus = (step: RoundLifecycleStep, status: RoundLifecycleEventStatus): "started" | "success" | "failed" | "skipped" | "review_required" => {
  if (status === "entered") {
    return "started";
  }
  if (step === "review_required") {
    return "review_required";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  return "success";
};

export const resolveRuntimeSkillId = (step: RoundLifecycleStep, detail: string, eventType?: string): string => {
  if (step === "branch") {
    return detail === "product_yes_high_confidence" ? "branch_product_yes" : detail === "product_no_high_confidence" ? "branch_product_no" : "branch_uncertain";
  }
  if (step === "detect_login_or_safety" && detail.includes("login")) {
    return "detect_login_state";
  }
  return resolveRuntimeStepSkillId(step, eventType);
};

export const updateLatestTrace = (deliveryState: RuntimeDeliveryState, input: { step: RoundLifecycleStep; status: string; detail: string | null }): void => {
  deliveryState.latestRoundTraceStep = input.step;
  deliveryState.latestRoundTraceStatus = input.status;
  deliveryState.latestRoundTraceDetail = input.detail;
};
