import type {
  OpenResult,
  OpenTargetProfile,
  ParsedOpenRequest,
} from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import {
  buildOpenResult,
  buildIdempotencyFailureResult,
  buildInvalidAllowFailureResult,
  buildSessionGateFailureResult,
  buildTargetPolicyFailureResult,
  buildUrlSafetyFailureResult,
  createOpenFailure,
} from "./open-execution-builders.js";
import type { NavigationResult, PostOpenStateResult, SessionGateResult, TargetPolicyResult, UrlSafetyResult, ClockSnapshot, IdempotencyReservationResult } from "./open-executor-flow-types.js";

export const resolveTargetPolicyFailureResult = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  started: ClockSnapshot;
  clock: OpenChildExecutionContext["clock"];
  targetPolicy: TargetPolicyResult;
}): OpenResult | null => {
  if (input.targetPolicy.ok && input.targetPolicy.resolvedTargetUrl) {
    return null;
  }

  const ended = input.clock.now();
  if (!input.targetPolicy.ok) {
    return buildTargetPolicyFailureResult({
      request: input.request,
      profile: input.profile,
      startedAt: input.started,
      endedAt: ended,
      targetPolicyDecision: input.targetPolicy.decision,
      reason: input.targetPolicy.reason,
    });
  }

  return buildInvalidAllowFailureResult({
    request: input.request,
    profile: input.profile,
    startedAt: input.started,
    endedAt: ended,
    targetPolicyDecision: input.targetPolicy.decision,
  });
};

export const resolveUrlSafetyFailureResult = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  started: ClockSnapshot;
  clock: OpenChildExecutionContext["clock"];
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
}): OpenResult | null => {
  if (input.urlSafety.ok && input.urlSafety.normalizedUrl) {
    return null;
  }

  const ended = input.clock.now();
  return buildUrlSafetyFailureResult({
    request: input.request,
    profile: input.profile,
    startedAt: input.started,
    endedAt: ended,
    targetPolicyDecision: input.targetPolicy.decision,
    reason: input.urlSafety.reason,
  });
};

export const resolveSessionGateFailureResult = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  started: ClockSnapshot;
  clock: OpenChildExecutionContext["clock"];
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
  sessionGate: SessionGateResult;
  normalizedTargetUrl: string;
}): OpenResult | null => {
  if (input.sessionGate.ok && input.sessionGate.sessionSnapshot) {
    return null;
  }

  const ended = input.clock.now();
  return buildSessionGateFailureResult({
    request: input.request,
    profile: input.profile,
    startedAt: input.started,
    endedAt: ended,
    targetPolicyDecision: input.targetPolicy.decision,
    urlSafetyDecision: input.urlSafety.decision,
    sessionGate: input.sessionGate,
    normalizedTargetUrl: input.normalizedTargetUrl,
  });
};

export const resolveIdempotencyFailureResult = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  started: ClockSnapshot;
  clock: OpenChildExecutionContext["clock"];
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
  sessionGate: SessionGateResult;
  normalizedTargetUrl: string;
  idempotency: IdempotencyReservationResult;
}): OpenResult | null => {
  if (input.idempotency.ok) {
    return null;
  }

  const beforeSession = input.sessionGate.sessionSnapshot;
  if (beforeSession === null) {
    return buildSessionGateFailureResult({
      request: input.request,
      profile: input.profile,
      startedAt: input.started,
      endedAt: input.clock.now(),
      targetPolicyDecision: input.targetPolicy.decision,
      urlSafetyDecision: input.urlSafety.decision,
      sessionGate: input.sessionGate,
      normalizedTargetUrl: input.normalizedTargetUrl,
    });
  }

  const ended = input.clock.now();
  return buildIdempotencyFailureResult({
    request: input.request,
    profile: input.profile,
    startedAt: input.started,
    endedAt: ended,
    targetPolicyDecision: input.targetPolicy.decision,
    urlSafetyDecision: input.urlSafety.decision,
    sessionDecision: input.sessionGate.decision,
    beforeSession,
    normalizedTargetUrl: input.normalizedTargetUrl,
    idempotency: {
      idempotencyKey: input.idempotency.idempotencyKey,
      decision: input.idempotency.decision,
      reason: input.idempotency.reason,
      alreadyOnTargetHandlingMode: input.idempotency.alreadyOnTargetHandlingMode,
    },
  });
};

export const buildOpenChildResult = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
  sessionGate: SessionGateResult;
  navigation: NavigationResult;
  postOpenState: PostOpenStateResult;
  idempotency: IdempotencyReservationResult;
  beforeSession: NonNullable<SessionGateResult["sessionSnapshot"]>;
  started: ClockSnapshot;
  ended: ClockSnapshot;
  pageStateHandoffRef: string;
}): OpenResult => buildOpenResult({
  request: input.request,
  profile: input.profile,
  targetPolicyDecision: input.targetPolicy.decision,
  urlSafetyDecision: input.urlSafety.decision,
  sessionDecision: input.sessionGate.decision,
  navigationDecision: input.navigation.decision,
  postOpenStateDecision: input.postOpenState.decision,
  idempotencyKey: input.idempotency.idempotencyKey,
  idempotencyDecision: input.idempotency.decision,
  beforeSession: input.beforeSession,
  afterSession: input.navigation.afterSession,
  startedAt: input.started.isoTimestamp,
  endedAt: input.ended.isoTimestamp,
  startedMonotonicMs: input.started.monotonicMs,
  endedMonotonicMs: input.ended.monotonicMs,
  failureReason: input.postOpenState.status === "failed"
    ? createOpenFailure({
        code: input.navigation.failureCode ?? input.postOpenState.failureCode ?? "post_open_state_failed",
        message: input.postOpenState.reason ?? input.navigation.reason ?? "open failed before post-open observation handoff completed",
      })
    : null,
  reviewRequiredReason: input.postOpenState.status === "review_required" ? input.postOpenState.reason : null,
  dataQualityFlags: input.postOpenState.dataQualityFlags,
  sessionSnapshotAvailable: input.navigation.sessionSnapshotAvailable,
  sessionSnapshotFailureReason: input.navigation.sessionSnapshotFailureReason,
});
