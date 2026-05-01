import type { RoundLifecycleEventStatus, RoundLifecycleStep } from "../../types/evidence-packet.js";
import type { RuntimeDeliveryState } from "../../types/runtime.js";
import { resolveRuntimeStepSkillId } from "./runtime-skill-support.js";

const COMPLETED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  task_start: "task_started",
  single_video_round_start: "single_video_round_started",
  review_required: "review_required",
  stop: "task_stopped",
  branch: "branch_decision_completed",
  record_video_evidence: "record_video_evidence_completed",
};

const ENTERED_EVENT_TYPES: Partial<Record<RoundLifecycleStep, string>> = {
  scroll_next_video: "scroll_next_video_started",
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
