import type { OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import {
  evaluateOpenTargetPolicy,
  evaluateRealChromeSession,
  evaluateUrlSafety,
} from "./open-execution-gates.js";
import {
  resolveIdempotencyFailureResult,
  resolveSessionGateFailureResult,
  resolveTargetPolicyFailureResult,
  resolveUrlSafetyFailureResult,
} from "./open-executor-flow-support.js";
import type {
  ClockSnapshot,
  IdempotencyReservationResult,
  SessionGateResult,
  TargetPolicyResult,
  UrlSafetyResult,
} from "./open-executor-flow-types.js";

export type OpenChildTargetAndUrlState = {
  started: ClockSnapshot;
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
};

export type OpenChildSessionGateState = OpenChildTargetAndUrlState & {
  sessionGate: SessionGateResult;
  normalizedTargetUrl: string;
};

export type OpenChildPreflightState = OpenChildSessionGateState & {
  idempotency: IdempotencyReservationResult;
};

function resolveOpenProfileOverride(input: {
  request: ParsedOpenRequest;
  context: OpenChildExecutionContext;
}) {
  return input.context.profilePort?.resolveProfileOverride({
    childCapabilityId: input.request.childCapabilityId,
    platformId: input.request.platformId,
  }) ?? null;
}

function resolveTargetPolicyFailureOrState(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  started: ClockSnapshot;
}) {
  const targetPolicy = evaluateOpenTargetPolicy({
    request: input.request,
    profile: input.profile,
    profileOverride: resolveOpenProfileOverride(input),
  });
  const failureResult = resolveTargetPolicyFailureResult({
    request: input.request,
    profile: input.profile,
    started: input.started,
    clock: input.context.clock,
    targetPolicy,
  });
  return { targetPolicy, failureResult };
}

function resolveUrlSafetyFailureOrState(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  started: ClockSnapshot;
  targetPolicy: TargetPolicyResult;
}):
  | { urlSafety: UrlSafetyResult; failureResult: null }
  | { urlSafety?: never; failureResult: OpenResult } {
  const resolvedTargetUrl = input.targetPolicy.resolvedTargetUrl;
  if (resolvedTargetUrl === null) {
    return { failureResult: resolveTargetPolicyFailureResult({ request: input.request, profile: input.profile, started: input.started, clock: input.context.clock, targetPolicy: input.targetPolicy })! };
  }

  const urlSafety = evaluateUrlSafety({
    profile: input.profile,
    targetUrl: resolvedTargetUrl,
  });
  const failureResult = resolveUrlSafetyFailureResult({
    request: input.request,
    profile: input.profile,
    started: input.started,
    clock: input.context.clock,
    targetPolicy: input.targetPolicy,
    urlSafety,
  });
  if (failureResult) {
    return { failureResult };
  }
  return { urlSafety, failureResult: null };
}

const resolveOpenChildTargetAndUrlState = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenChildTargetAndUrlState | { failureResult: OpenResult }> => {
  const started = input.context.clock.now();
  const targetPolicyState = resolveTargetPolicyFailureOrState({ ...input, started });
  if (targetPolicyState.failureResult) {
    return { failureResult: targetPolicyState.failureResult };
  }

  const urlSafetyState = resolveUrlSafetyFailureOrState({
    ...input,
    started,
    targetPolicy: targetPolicyState.targetPolicy,
  });
  if (urlSafetyState.failureResult) {
    return { failureResult: urlSafetyState.failureResult };
  }

  return {
    started,
    targetPolicy: targetPolicyState.targetPolicy,
    urlSafety: urlSafetyState.urlSafety,
  };
};

const resolveOpenChildSessionGateState = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildTargetAndUrlState;
}): Promise<OpenChildSessionGateState | { failureResult: OpenResult }> => {
  const normalizedTargetUrl = input.state.urlSafety.normalizedUrl;
  if (normalizedTargetUrl === null) {
    return { failureResult: resolveUrlSafetyFailureResult({ request: input.request, profile: input.profile, started: input.state.started, clock: input.context.clock, targetPolicy: input.state.targetPolicy, urlSafety: input.state.urlSafety })! };
  }

  const sessionGate = await evaluateRealChromeSession({
    browser: input.context.browser,
  });
  const sessionGateFailure = resolveSessionGateFailureResult({
    request: input.request,
    profile: input.profile,
    started: input.state.started,
    clock: input.context.clock,
    targetPolicy: input.state.targetPolicy,
    urlSafety: input.state.urlSafety,
    sessionGate,
    normalizedTargetUrl,
  });
  if (sessionGateFailure) {
    return { failureResult: sessionGateFailure };
  }

  return {
    ...input.state,
    sessionGate,
    normalizedTargetUrl,
  };
};

const resolveOpenChildIdempotencyState = (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildSessionGateState;
}): OpenChildPreflightState | { failureResult: OpenResult } => {
  const sessionSnapshot = input.state.sessionGate.sessionSnapshot;
  if (sessionSnapshot === null) {
    return { failureResult: resolveSessionGateFailureResult({ request: input.request, profile: input.profile, started: input.state.started, clock: input.context.clock, targetPolicy: input.state.targetPolicy, urlSafety: input.state.urlSafety, sessionGate: input.state.sessionGate, normalizedTargetUrl: input.state.normalizedTargetUrl })! };
  }

  const reservationClock = input.context.clock.now();
  const idempotency = input.context.idempotency.reserve({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: input.state.normalizedTargetUrl,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    currentUrl: sessionSnapshot.currentUrl,
    allowReplay: input.profile.allowReplay,
    nowIsoTimestamp: reservationClock.isoTimestamp,
    nowMonotonicMs: reservationClock.monotonicMs,
    ttlMs: input.profile.idempotencyPolicy.ttlMs,
    maxReservations: input.profile.idempotencyPolicy.maxReservations,
  });
  const idempotencyFailure = resolveIdempotencyFailureResult({
    request: input.request,
    profile: input.profile,
    started: input.state.started,
    clock: input.context.clock,
    targetPolicy: input.state.targetPolicy,
    urlSafety: input.state.urlSafety,
    sessionGate: input.state.sessionGate,
    normalizedTargetUrl: input.state.normalizedTargetUrl,
    idempotency,
  });
  if (idempotencyFailure) {
    return { failureResult: idempotencyFailure };
  }

  return {
    ...input.state,
    idempotency,
  };
};

const resolveOpenChildSessionAndIdempotencyState = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildTargetAndUrlState;
}): Promise<OpenChildPreflightState | { failureResult: OpenResult }> => {
  const sessionGateState = await resolveOpenChildSessionGateState(input);
  if ("failureResult" in sessionGateState) {
    return sessionGateState;
  }

  return resolveOpenChildIdempotencyState({
    request: input.request,
    profile: input.profile,
    context: input.context,
    state: sessionGateState,
  });
};

export const resolveOpenChildPreflight = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenChildPreflightState | { failureResult: OpenResult }> => {
  const targetAndUrlState = await resolveOpenChildTargetAndUrlState(input);
  if ("failureResult" in targetAndUrlState) {
    return targetAndUrlState;
  }

  return resolveOpenChildSessionAndIdempotencyState({
    request: input.request,
    profile: input.profile,
    context: input.context,
    state: targetAndUrlState,
  });
};
