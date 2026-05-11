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
  "COMMAND_DISPATCH_READY",
  "COMMAND_RESPONSE_SENT",
  "COMMANDER_COMMAND_ENVELOPE_BUILT",
  "NERVE_BUS_ENVELOPE_CREATED",
  "NERVE_BUS_DISPATCH_STARTED",
  "NERVE_BUS_RESULT_ENVELOPE_RECEIVED",
  "NERVE_BUS_RESULT_SEMANTIC_GATE_PASSED",
  "NERVE_BUS_TRANSFER_PROOF_BUILT",
  "ORCHESTRATION_START_RECEIVED",
  "MISSION_START_CONTEXT_CONFIRMED",
  "MISSION_BACKGROUND_FAILED",
  "MISSION_BACKGROUND_STALLED",
  "ORCHESTRATION_LOOP_GUARD_DECISION",
  "RUNTIME_STEP_SELECTED",
  "STEP_PRECONDITION_CHECKED",
  "STEP_DISPATCH_STARTED",
  "CAPABILITY_CALL_STARTED",
  "CAPABILITY_CALL_COMPLETED",
  "CAPABILITY_CALL_FAILED",
  "CAPABILITY_CALL_REVIEW_REQUIRED",
  "AI_INPUT_REQUEST_DEBUG",
  "AI_PROMPT_REQUEST_DEBUG",
  "AI_REQUEST_DEBUG",
  "AI_INPUT_DEBUG_REJECTED",
  "AI_RAW_RESPONSE_DEBUG",
  "AI_NORMALIZED_RESPONSE_DEBUG",
  "AI_RESPONSE_DEBUG",
  "AI_ERROR_DEBUG",
  "POST_ACTION_VERIFICATION_STARTED",
  "POST_ACTION_VERIFICATION_PASSED",
  "POST_ACTION_VERIFICATION_FAILED",
  "POST_ACTION_VERIFICATION_REVIEW_REQUIRED",
  "FORENSICS_RECORD_WRITE_REQUESTED",
  "FORENSICS_RECORD_WRITTEN",
  "FORENSICS_RECORD_WRITE_REVIEW_REQUIRED",
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
  "click_next_video_started",
  "click_next_video_completed",
  "next_video_wait_started",
  "review_required",
  "task_stopped",
  "CHROME_RESOURCE_CHECKPOINT",
  "CHROME_RESOURCE_WARNING",
  "runtime_snapshot_summary",
  "step_timeout",
]);

const MAX_TERMINAL_DEDUPE_KEYS = 500;
const SNAPSHOT_RUNTIME_EVENT_TYPES = new Set(["runtime_snapshot_summary", "CHROME_RESOURCE_CHECKPOINT", "CHROME_RESOURCE_WARNING"]);

function resolveTerminalDedupeKey(entry: StructuredRuntimeEvent): string | null {
  if (!entry.runtimeCallId && !entry.diagnosticPayloadRef && !entry.eventId) {
    return null;
  }

  return [
    entry.runtimeCallId ?? "no-runtime-call",
    entry.eventType,
    entry.implementationStatus ?? "no-implementation-status",
    entry.diagnosticPayloadRef ?? entry.eventId,
  ].join("|");
}

function shouldMirrorRuntimeEvent(entry: StructuredRuntimeEvent, level: StructuredLogLevel): boolean {
  if (level === "debug") {
    return true;
  }

  return entry.status === "failed"
    || entry.status === "review_required"
    || INFO_RUNTIME_EVENT_TYPES.has(entry.eventType);
}

function isSnapshotLogEntry(logEntry: StructuredLogEntry): boolean {
  return logEntry.kind === "event" && SNAPSHOT_RUNTIME_EVENT_TYPES.has(logEntry.entry.eventType);
}

function isStallLogEntry(logEntry: StructuredLogEntry): boolean {
  return logEntry.kind === "event" && (logEntry.entry.eventType === "step_timeout" || logEntry.entry.reason === "step_timeout");
}

function resolveTerminalPrefix(logEntry: StructuredLogEntry): "grasseye:event" | "grasseye:action" | "grasseye:review" | "grasseye:stall" | "grasseye:snapshot" {
  if (logEntry.kind === "action") {
    return logEntry.entry.result === "review_required" ? "grasseye:review" : "grasseye:action";
  }

  if (isSnapshotLogEntry(logEntry)) {
    return "grasseye:snapshot";
  }

  if (isStallLogEntry(logEntry)) {
    return "grasseye:stall";
  }

  return logEntry.entry.status === "review_required" ? "grasseye:review" : "grasseye:event";
}

function shouldSkipMirroredRuntimeEvent(
  entry: StructuredRuntimeEvent,
  mirroredRuntimeDedupeKeys: Set<string>,
): boolean {
  const dedupeKey = resolveTerminalDedupeKey(entry);
  if (!dedupeKey) {
    return false;
  }

  if (mirroredRuntimeDedupeKeys.has(dedupeKey)) {
    return true;
  }

  mirroredRuntimeDedupeKeys.add(dedupeKey);
  if (mirroredRuntimeDedupeKeys.size > MAX_TERMINAL_DEDUPE_KEYS) {
    const firstKey = mirroredRuntimeDedupeKeys.values().next().value;
    if (firstKey) {
      mirroredRuntimeDedupeKeys.delete(firstKey);
    }
  }

  return false;
}

function shouldSkipStructuredTerminalLogEntry(
  logEntry: StructuredLogEntry,
  level: StructuredLogLevel,
  mirroredRuntimeDedupeKeys: Set<string>,
): boolean {
  if (logEntry.kind === "event" && !shouldMirrorRuntimeEvent(logEntry.entry, level)) {
    return true;
  }

  return logEntry.kind === "event" && logEntry.entry.eventType.startsWith("AI_")
    ? shouldSkipMirroredRuntimeEvent(logEntry.entry, mirroredRuntimeDedupeKeys)
    : false;
}

function buildStructuredTerminalPayload(logEntry: StructuredLogEntry, level: StructuredLogLevel) {
  return logEntry.kind === "event"
    ? buildEventPayload(logEntry.entry, level)
    : buildActionPayload(logEntry.entry, level);
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
  const mirroredRuntimeDedupeKeys = new Set<string>();

  return (logEntry) => {
    if (shouldSkipStructuredTerminalLogEntry(logEntry, level, mirroredRuntimeDedupeKeys)) {
      return;
    }

    const prefix = resolveTerminalPrefix(logEntry);
    const payload = buildStructuredTerminalPayload(logEntry, level);

    process.stdout.write(`[${prefix}] ${JSON.stringify(payload)}\n`);
  };
}
