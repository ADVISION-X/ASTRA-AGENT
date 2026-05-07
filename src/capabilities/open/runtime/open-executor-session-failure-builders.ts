import type {
  BrowserSessionSnapshot,
  OpenFailure,
  OpenResult,
  OpenSessionDecision,
  OpenTargetProfile,
  OpenTargetPolicyDecision,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
} from "../contract.js";
import {
  buildFailureResult,
  createPostOpenFailure,
  createUnavailableSession,
  makeDataFlag,
} from "./open-executor-failure-builders.js";

type ClockSnapshot = { isoTimestamp: string; monotonicMs: number };
type OpenIdempotencyDecision = "reserved" | "duplicate_review_required" | "already_on_target" | "scope_capacity_exceeded" | "not_started";

type SessionGateInput = {
  status: "failed" | "review_required";
  decision: OpenSessionDecision;
  reason: string | null;
  failureCode?: string | null;
  sessionSnapshot: BrowserSessionSnapshot | null;
};

export function buildSessionGateFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  targetPolicyDecision: OpenTargetPolicyDecision;
  urlSafetyDecision: OpenUrlSafetyDecision;
  sessionGate: SessionGateInput;
  normalizedTargetUrl: string;
}): OpenResult {
  const fallbackSession = input.sessionGate.sessionSnapshot ?? createUnavailableSession(input.sessionGate.reason ?? "session gate blocked");
  const failureCode = input.sessionGate.failureCode ?? "session_gate_blocked";
  return buildFailureResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionGate.decision,
    navigationDecision: {
      status: "failed",
      reason: input.sessionGate.reason,
      browserActionId: null,
      openedUrl: fallbackSession.currentUrl,
      pageTitleAfter: fallbackSession.currentTitle,
      navigationAttemptRef: `${input.request.runId}:session-gate-blocked`,
      navigationCallId: `${input.request.runId}:session-gate-blocked`,
      redirectChain: [input.normalizedTargetUrl],
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      browserOpenStillRunningGuard: false,
      alreadyOnTargetHandlingMode: "not_applicable",
    },
    postOpenStateDecision: createPostOpenFailure(input.sessionGate.status, "navigation_failure_observation", input.sessionGate.reason),
    idempotencyKey: `${input.request.runId}:session-gate-blocked`,
    idempotencyDecision: "not_started",
    beforeSession: fallbackSession,
    afterSession: fallbackSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: input.sessionGate.status === "failed"
      ? ({ code: failureCode, message: input.sessionGate.reason ?? "open session gate blocked" } as OpenFailure)
      : null,
    reviewRequiredReason: input.sessionGate.status === "review_required" ? input.sessionGate.reason : null,
    dataQualityFlags: [makeDataFlag(failureCode, input.sessionGate.status === "failed" ? "error" : "warn", input.sessionGate.reason ?? "open session gate blocked")],
    sessionSnapshotAvailable: input.sessionGate.sessionSnapshot !== null,
    sessionSnapshotFailureReason: input.sessionGate.sessionSnapshot === null ? input.sessionGate.reason : null,
  });
}

export function buildIdempotencyFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  targetPolicyDecision: OpenTargetPolicyDecision;
  urlSafetyDecision: OpenUrlSafetyDecision;
  sessionDecision: OpenSessionDecision;
  beforeSession: BrowserSessionSnapshot;
  normalizedTargetUrl: string;
  idempotency: {
    idempotencyKey: string;
    decision: OpenIdempotencyDecision;
    reason: string | null;
    alreadyOnTargetHandlingMode: "not_applicable" | "session_reused";
  };
}): OpenResult {
  return buildFailureResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionDecision,
    navigationDecision: {
      status: "review_required",
      reason: input.idempotency.reason,
      browserActionId: null,
      openedUrl: input.beforeSession.currentUrl,
      pageTitleAfter: input.beforeSession.currentTitle,
      navigationAttemptRef: `${input.idempotency.idempotencyKey}:duplicate`,
      navigationCallId: `${input.idempotency.idempotencyKey}:duplicate`,
      redirectChain: [input.normalizedTargetUrl],
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      browserOpenStillRunningGuard: false,
      alreadyOnTargetHandlingMode: input.idempotency.alreadyOnTargetHandlingMode,
    },
    postOpenStateDecision: createPostOpenFailure("review_required", "navigation_failure_observation", input.idempotency.reason),
    idempotencyKey: input.idempotency.idempotencyKey,
    idempotencyDecision: input.idempotency.decision,
    beforeSession: input.beforeSession,
    afterSession: input.beforeSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: null,
    reviewRequiredReason: input.idempotency.reason,
    dataQualityFlags: [makeDataFlag("duplicate_open", "warn", input.idempotency.reason ?? "duplicate open detected")],
    sessionSnapshotAvailable: true,
    sessionSnapshotFailureReason: null,
  });
}
