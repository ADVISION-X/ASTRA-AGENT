import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

export type ExecutionClockSnapshot = {
  iso: string;
  monotonicMs: number;
};

export type NerveBusChildOutcome<TEnvelope extends SupportedEnvelope, TResult extends SupportedResultEnvelope> = Awaited<ReturnType<NerveBusChildDefinition<TEnvelope, TResult>["execute"]>>;

export type ExecutionFailureDetails = {
  failureReason: string;
  integrityDecision: "valid" | "missing_payload_ref" | "missing_input_ref" | "stale" | "expired" | "out_of_order" | "mismatched_result" | "payload_ref_policy_failed";
  idempotencyDecision: "executed" | "duplicate_skipped" | "replay_rejected";
  sequenceDecision: "accepted" | "out_of_order" | "duplicate" | "not_started";
  queueDecision: "acquired" | "queue_rejected" | "not_started";
  timeoutDecision: "within_timeout" | "timed_out" | "not_started";
  handlerDecision: "executed" | "missing_handler" | "threw" | "invalid_result" | "timed_out" | "aborted" | "not_invoked";
  policyDecision: "allowed" | "forbidden_route";
  status: "failed" | "review_required";
  reviewRequiredReason: string | null;
  transportDecision?: "executed" | "duplicate_skipped" | "replay_rejected" | "queue_rejected";
  handlerCallId: string;
  handlerStartedAt: string;
  handlerEndedAt: string;
  handlerDurationMs: number;
};