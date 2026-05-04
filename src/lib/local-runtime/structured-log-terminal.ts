import type { StructuredRuntimeEvent } from "../../types/structured-log.js";

import { buildActionPayload, buildEventPayload } from "./structured-log-payload.js";
import type { StructuredLogEntry, StructuredLogListener } from "./structured-log-bus.js";

export type StructuredLogLevel = "info" | "debug";

const INFO_RUNTIME_EVENT_TYPES = new Set([
  "HUMAN_COMMAND_DRAFTED",
  "HUMAN_COMMAND_RECEIVED",
  "HUMAN_COMMAND_VALIDATED",
  "MISSION_READINESS_CHECK_STARTED",
  "MISSION_PREFLIGHT_STARTED",
  "MISSION_PREFLIGHT_PASSED",
  "MISSION_PREFLIGHT_FAILED",
  "COMMAND_ACCEPTED",
  "COMMAND_REJECTED",
  "COMMANDER_COMMAND_ENVELOPE_BUILT",
  "NERVE_BUS_ENVELOPE_CREATED",
  "NERVE_BUS_DISPATCH_STARTED",
  "ORCHESTRATION_START_RECEIVED",
  "MISSION_ACTIVATION_SNAPSHOT_FROZEN",
  "ORCHESTRATION_LOOP_GUARD_DECISION",
  "MAP_STEP_SELECTED",
  "STEP_PRECONDITION_CHECKED",
  "STEP_DISPATCH_STARTED",
  "CAPABILITY_CALL_STARTED",
  "CAPABILITY_CALL_COMPLETED",
  "CAPABILITY_CALL_FAILED",
  "CAPABILITY_CALL_REVIEW_REQUIRED",
  "POST_ACTION_VERIFICATION_STARTED",
  "POST_ACTION_VERIFICATION_PASSED",
  "POST_ACTION_VERIFICATION_FAILED",
  "POST_ACTION_VERIFICATION_REVIEW_REQUIRED",
  "FORENSICS_RECORD_WRITE_REQUESTED",
  "FORENSICS_RECORD_WRITTEN",
  "STEP_TRANSITION_EVALUATED",
  "MISSION_FINALIZED",
  "MISSION_STOPPED",
  "MISSION_PAUSED",
  "MISSION_REVIEW_REQUIRED",
  "MISSION_FAILED",
  "task_started",
  "open_target_page_started",
  "open_target_page_completed",
  "detect_login_or_safety_started",
  "detect_login_or_safety_completed",
  "wait_feed_ready_started",
  "wait_feed_ready_completed",
  "single_video_round_started",
  "wait_video_stable_started",
  "wait_video_stable_completed",
  "identify_current_video_started",
  "identify_current_video_completed",
  "calibrate_geometry_started",
  "calibrate_geometry_completed",
  "sample_video_frames_started",
  "multi_frame_capture_completed",
  "create_contact_sheet_completed",
  "local_ai_input_prepared",
  "local_ai_health_check_started",
  "local_ai_health_check_completed",
  "local_ai_task_started",
  "local_ai_runtime_request_started",
  "local_ai_adapter_request_started",
  "local_ai_adapter_response_received",
  "local_ai_output_normalized",
  "local_ai_output_parsed",
  "local_ai_task_completed",
  "ask_ai_product_presence_started",
  "ask_ai_product_presence_completed",
  "validate_ai_output_completed",
  "branch_decision_completed",
  "finalize_browse_ledger_completed",
  "finalize_evidence_packet_completed",
  "finalize_failed_or_review_record_completed",
  "scroll_next_video_started",
  "scroll_next_video_completed",
  "next_video_wait_started",
  "review_required",
  "task_stopped",
  "runtime_snapshot_summary",
  "step_timeout",
]);

function shouldMirrorRuntimeEvent(entry: StructuredRuntimeEvent, level: StructuredLogLevel): boolean {
  if (level === "debug") {
    return true;
  }

  return entry.status === "failed"
    || entry.status === "review_required"
    || INFO_RUNTIME_EVENT_TYPES.has(entry.eventType);
}

function resolveTerminalPrefix(logEntry: StructuredLogEntry): "grasseye:event" | "grasseye:action" | "grasseye:review" | "grasseye:stall" | "grasseye:snapshot" {
  if (logEntry.kind === "action") {
    return logEntry.entry.result === "review_required" ? "grasseye:review" : "grasseye:action";
  }

  if (logEntry.entry.eventType === "runtime_snapshot_summary") {
    return "grasseye:snapshot";
  }

  if (logEntry.entry.eventType === "step_timeout" || logEntry.entry.reason === "step_timeout") {
    return "grasseye:stall";
  }

  return logEntry.entry.status === "review_required" ? "grasseye:review" : "grasseye:event";
}

export function isStructuredLogStdoutEnabled(): boolean {
  return process.env.GRASSEYE_STRUCTURED_LOG_STDOUT !== "0";
}

export function resolveStructuredLogLevel(): StructuredLogLevel {
  return process.env.GRASSEYE_STRUCTURED_LOG_LEVEL === "debug" || process.env.GRASSEYE_LOG_LEVEL === "debug"
    ? "debug"
    : "info";
}

export function createStructuredTerminalLogListener(level: StructuredLogLevel = resolveStructuredLogLevel()): StructuredLogListener {
  return (logEntry) => {
    if (logEntry.kind === "event" && !shouldMirrorRuntimeEvent(logEntry.entry, level)) {
      return;
    }

    const prefix = resolveTerminalPrefix(logEntry);
    const payload = logEntry.kind === "event"
      ? buildEventPayload(logEntry.entry, level)
      : buildActionPayload(logEntry.entry, level);

    process.stdout.write(`[${prefix}] ${JSON.stringify(payload)}\n`);
  };
}
