import type {
  OpenResult,
  OpenTargetProfile,
  ParsedOpenRequest,
} from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import {
  evaluateOpenTargetPolicy,
  evaluatePostOpenState,
  evaluateRealChromeSession,
  evaluateUrlSafety,
  resolveOpenTimeoutMs,
  runOpenNavigation,
} from "./open-execution-gates.js";
import {
  buildOpenChildResult,
  resolveIdempotencyFailureResult,
  resolveSessionGateFailureResult,
  resolveTargetPolicyFailureResult,
  resolveUrlSafetyFailureResult,
} from "./open-executor-flow-support.js";
import type {
  ClockSnapshot,
  IdempotencyReservationResult,
  NavigationResult,
  PostOpenStateResult,
  SessionGateResult,
  TargetPolicyResult,
  UrlSafetyResult,
} from "./open-executor-flow-types.js";

type OpenChildTargetAndUrlState = {
  started: ClockSnapshot;
  targetPolicy: TargetPolicyResult;
  urlSafety: UrlSafetyResult;
};

type OpenChildSessionGateState = OpenChildTargetAndUrlState & {
  sessionGate: SessionGateResult;
  normalizedTargetUrl: string;
};

type OpenChildPreflightState = OpenChildSessionGateState & {
  idempotency: IdempotencyReservationResult;
};

const resolveOpenChildTargetAndUrlState = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenChildTargetAndUrlState | { failureResult: OpenResult }> => {
  const started = input.context.clock.now();
  const profileOverride = input.context.profilePort?.resolveProfileOverride({
    childCapabilityId: input.request.childCapabilityId,
    platformId: input.request.platformId,
  }) ?? null;

  const targetPolicy = evaluateOpenTargetPolicy({
    request: input.request,
    profile: input.profile,
    profileOverride,
  });
  const targetPolicyFailure = resolveTargetPolicyFailureResult({
    request: input.request,
    profile: input.profile,
    started,
    clock: input.context.clock,
    targetPolicy,
  });
  if (targetPolicyFailure) {
    return { failureResult: targetPolicyFailure };
  }

  const urlSafety = evaluateUrlSafety({
    profile: input.profile,
    targetUrl: targetPolicy.resolvedTargetUrl,
  });
  const urlSafetyFailure = resolveUrlSafetyFailureResult({
    request: input.request,
    profile: input.profile,
    started,
    clock: input.context.clock,
    targetPolicy,
    urlSafety,
  });
  if (urlSafetyFailure) {
    return { failureResult: urlSafetyFailure };
  }

  return {
    started,
    targetPolicy,
    urlSafety,
  };
};

const resolveOpenChildSessionGateState = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildTargetAndUrlState;
}): Promise<OpenChildSessionGateState | { failureResult: OpenResult }> => {
  const normalizedTargetUrl = input.state.urlSafety.normalizedUrl;
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
  const reservationClock = input.context.clock.now();
  const idempotency = input.context.idempotency.reserve({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: input.state.normalizedTargetUrl,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    currentUrl: input.state.sessionGate.sessionSnapshot.currentUrl,
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

const resolveOpenChildPreflight = async (input: {
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

const completeOpenChildExecution = async (input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
  state: OpenChildPreflightState;
}): Promise<OpenResult> => {
  const pageStateHandoffRef = `page-state:${input.request.runId}:${input.request.childCapabilityId}`;
  const navigation = await runOpenNavigation({
    browser: input.context.browser,
    request: input.request,
    profile: input.profile,
    targetUrl: input.state.normalizedTargetUrl,
    targetTitle: input.state.targetPolicy.resolvedTargetTitle ?? input.profile.defaultTitle,
    timeoutMs: resolveOpenTimeoutMs(input.profile),
    idempotencyKey: input.state.idempotency.idempotencyKey,
    reservationDecision: input.state.idempotency.decision === "already_on_target" ? "already_on_target" : "reserved",
    alreadyOnTargetDecision: input.state.idempotency.alreadyOnTargetDecision,
    targetProfileRef: input.state.targetPolicy.decision.targetProfileRef,
    beforeSession: input.state.sessionGate.sessionSnapshot,
  });

  const postOpenState = evaluatePostOpenState({
    profile: input.profile,
    beforeSession: input.state.sessionGate.sessionSnapshot,
    afterSession: navigation.afterSession,
    navigationDecision: navigation.decision,
    pageStateHandoffRef,
  });

  const ended = input.context.clock.now();
  if (postOpenState.status === "success") {
    input.context.idempotency.commitSuccess({ idempotencyKey: input.state.idempotency.idempotencyKey });
  } else if (input.state.idempotency.decision === "reserved") {
    input.context.idempotency.releaseOnFailure({ idempotencyKey: input.state.idempotency.idempotencyKey });
  }

  return buildOpenChildResult({
    request: input.request,
    profile: input.profile,
    targetPolicy: input.state.targetPolicy,
    urlSafety: input.state.urlSafety,
    sessionGate: input.state.sessionGate,
    navigation,
    postOpenState,
    idempotency: input.state.idempotency,
    beforeSession: input.state.sessionGate.sessionSnapshot,
    started: input.state.started,
    ended,
    pageStateHandoffRef,
  });
};

export async function executeOpenChildFlow(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
  const preflight = await resolveOpenChildPreflight(input);
  if ("failureResult" in preflight) {
    return preflight.failureResult;
  }

  return completeOpenChildExecution({
    request: input.request,
    profile: input.profile,
    context: input.context,
    state: preflight,
  });
}
