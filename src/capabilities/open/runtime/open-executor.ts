import type {
  OpenDataQualityFlag,
  OpenResult,
  OpenTargetProfile,
  ParsedOpenRequest,
} from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-context.js";
import { OpenResultSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildOpenResult } from "./open-result-builder.js";
import { evaluatePostOpenState } from "./post-open-state-gate.js";
import { evaluateRealChromeSession } from "./real-chrome-session-gate.js";
import { runOpenNavigation } from "./navigation-runner.js";
import { resolveOpenTimeoutMs } from "./open-timeout-policy.js";
import { evaluateOpenTargetPolicy } from "./target-policy-gate.js";
import { evaluateUrlSafety } from "./url-safety-gate.js";

function createUnavailableSession(reason: string) {
  return {
    open: false,
    currentUrl: "about:blank",
    currentTitle: null,
    browserExecutable: null,
    browserMode: "unsupported" as const,
    browserProfileRef: "open-session:unavailable",
    browserExecutablePath: null,
    profileStatus: "profile_unavailable" as const,
    profileDirectory: "unavailable",
    profileProvisioning: "managed_default" as const,
    profileVerificationStatus: "default_unverified" as const,
    profileVerificationReason: reason,
    loginState: "unknown" as const,
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  };
}

function makeDataFlag(code: string, severity: OpenDataQualityFlag["severity"], reason: string): OpenDataQualityFlag {
  return { code, severity, reason };
}

function createPostOpenFailure(status: OpenResult["status"], classification: "unknown" | "wrong_domain" | "security_wall" | "unexpected_redirect", reason: string | null) {
  return {
    status,
    classification,
    reason,
    openedUrl: null,
    pageTitleAfter: null,
    pageStateHandoffRequired: false,
    pageStateHandoffRef: null,
    authoritative: false as const,
    documentReadyState: null,
  };
}

export async function executeOpenChild(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
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
  if (!targetPolicy.ok) {
    const ended = input.context.clock.now();
    const unavailableSession = createUnavailableSession(targetPolicy.reason ?? "target policy blocked");
    return buildOpenResult({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: targetPolicy.decision,
      urlSafetyDecision: {
        status: "block",
        reason: targetPolicy.reason,
        normalizedUrl: null,
        hostname: null,
        scheme: null,
      },
      sessionDecision: {
        status: "block",
        reason: targetPolicy.reason,
        browserMode: unavailableSession.browserMode,
        profileStatus: unavailableSession.profileStatus,
        profileVerificationStatus: unavailableSession.profileVerificationStatus,
      },
      navigationDecision: {
        status: "failed",
        reason: targetPolicy.reason,
        browserActionId: null,
        openedUrl: null,
        pageTitleAfter: null,
        navigationAttemptRef: `${input.request.runId}:target-policy-blocked`,
        navigationCallId: `${input.request.runId}:target-policy-blocked`,
        redirectChain: [],
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      },
      postOpenStateDecision: createPostOpenFailure("failed", "unknown", targetPolicy.reason),
      idempotencyKey: `${input.request.runId}:target-policy-blocked`,
      idempotencyDecision: "not_started",
      beforeSession: unavailableSession,
      afterSession: unavailableSession,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: createOpenFailure({
        code: "target_policy_blocked",
        message: targetPolicy.reason ?? "open target policy blocked",
      }),
      reviewRequiredReason: null,
      dataQualityFlags: [makeDataFlag("target_policy_blocked", "error", targetPolicy.reason ?? "open target policy blocked")],
      sessionSnapshotAvailable: false,
      sessionSnapshotFailureReason: "target policy blocked before session evaluation",
    });
  }

  const resolvedTargetUrl = targetPolicy.resolvedTargetUrl;
  if (!resolvedTargetUrl) {
    const ended = input.context.clock.now();
    const unavailableSession = createUnavailableSession("target policy allow decision did not provide a resolved target url");
    return buildOpenResult({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: targetPolicy.decision,
      urlSafetyDecision: {
        status: "block",
        reason: "target policy allow decision did not provide a resolved target url",
        normalizedUrl: null,
        hostname: null,
        scheme: null,
      },
      sessionDecision: {
        status: "block",
        reason: "target policy allow decision did not provide a resolved target url",
        browserMode: unavailableSession.browserMode,
        profileStatus: unavailableSession.profileStatus,
        profileVerificationStatus: unavailableSession.profileVerificationStatus,
      },
      navigationDecision: {
        status: "failed",
        reason: "target policy allow decision did not provide a resolved target url",
        browserActionId: null,
        openedUrl: null,
        pageTitleAfter: null,
        navigationAttemptRef: `${input.request.runId}:target-policy-invalid-allow`,
        navigationCallId: `${input.request.runId}:target-policy-invalid-allow`,
        redirectChain: [],
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      },
      postOpenStateDecision: createPostOpenFailure("failed", "unknown", "target policy allow decision did not provide a resolved target url"),
      idempotencyKey: `${input.request.runId}:target-policy-invalid-allow`,
      idempotencyDecision: "not_started",
      beforeSession: unavailableSession,
      afterSession: unavailableSession,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: createOpenFailure({
        code: "target_policy_blocked",
        message: "target policy allow decision did not provide a resolved target url",
      }),
      reviewRequiredReason: null,
      dataQualityFlags: [makeDataFlag("target_policy_blocked", "error", "target policy allow decision did not provide a resolved target url")],
      sessionSnapshotAvailable: false,
      sessionSnapshotFailureReason: "target policy allow decision did not provide a resolved target url",
    });
  }

  const urlSafety = evaluateUrlSafety({
    profile: input.profile,
    targetUrl: resolvedTargetUrl,
  });
  if (!urlSafety.ok || !urlSafety.normalizedUrl) {
    const ended = input.context.clock.now();
    const unavailableSession = createUnavailableSession(urlSafety.reason ?? "url safety blocked");
    return buildOpenResult({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: targetPolicy.decision,
      urlSafetyDecision: urlSafety.decision,
      sessionDecision: {
        status: "block",
        reason: urlSafety.reason,
        browserMode: unavailableSession.browserMode,
        profileStatus: unavailableSession.profileStatus,
        profileVerificationStatus: unavailableSession.profileVerificationStatus,
      },
      navigationDecision: {
        status: "failed",
        reason: urlSafety.reason,
        browserActionId: null,
        openedUrl: null,
        pageTitleAfter: null,
        navigationAttemptRef: `${input.request.runId}:url-safety-blocked`,
        navigationCallId: `${input.request.runId}:url-safety-blocked`,
        redirectChain: targetPolicy.resolvedTargetUrl ? [targetPolicy.resolvedTargetUrl] : [],
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      },
      postOpenStateDecision: createPostOpenFailure("failed", "wrong_domain", urlSafety.reason),
      idempotencyKey: `${input.request.runId}:url-safety-blocked`,
      idempotencyDecision: "not_started",
      beforeSession: unavailableSession,
      afterSession: unavailableSession,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: createOpenFailure({
        code: "url_policy_blocked",
        message: urlSafety.reason ?? "open url safety blocked",
      }),
      reviewRequiredReason: null,
      dataQualityFlags: [makeDataFlag("url_policy_blocked", "error", urlSafety.reason ?? "open url safety blocked")],
      sessionSnapshotAvailable: false,
      sessionSnapshotFailureReason: "url policy blocked before session evaluation",
    });
  }

  const normalizedTargetUrl = urlSafety.normalizedUrl;
  const sessionGate = await evaluateRealChromeSession({
    browser: input.context.browser,
  });
  if (!sessionGate.ok || !sessionGate.sessionSnapshot) {
    const ended = input.context.clock.now();
    const fallbackSession = sessionGate.sessionSnapshot ?? createUnavailableSession(sessionGate.reason ?? "session gate blocked");
    return buildOpenResult({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: targetPolicy.decision,
      urlSafetyDecision: urlSafety.decision,
      sessionDecision: sessionGate.decision,
      navigationDecision: {
        status: "failed",
        reason: sessionGate.reason,
        browserActionId: null,
        openedUrl: fallbackSession.currentUrl,
        pageTitleAfter: fallbackSession.currentTitle,
        navigationAttemptRef: `${input.request.runId}:session-gate-blocked`,
        navigationCallId: `${input.request.runId}:session-gate-blocked`,
        redirectChain: [normalizedTargetUrl],
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: "not_applicable",
      },
      postOpenStateDecision: createPostOpenFailure(sessionGate.status, sessionGate.status === "review_required" ? "security_wall" : "unknown", sessionGate.reason),
      idempotencyKey: `${input.request.runId}:session-gate-blocked`,
      idempotencyDecision: "not_started",
      beforeSession: fallbackSession,
      afterSession: fallbackSession,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: sessionGate.status === "failed"
        ? createOpenFailure({
            code: sessionGate.failureCode ?? "session_gate_blocked",
            message: sessionGate.reason ?? "open session gate blocked",
          })
        : null,
      reviewRequiredReason: sessionGate.status === "review_required" ? sessionGate.reason : null,
      dataQualityFlags: [makeDataFlag(sessionGate.failureCode ?? "session_gate_blocked", sessionGate.status === "failed" ? "error" : "warn", sessionGate.reason ?? "open session gate blocked")],
      sessionSnapshotAvailable: sessionGate.sessionSnapshot !== null,
      sessionSnapshotFailureReason: sessionGate.sessionSnapshot === null ? sessionGate.reason : null,
    });
  }

  const reservationClock = input.context.clock.now();
  const idempotency = input.context.idempotency.reserve({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: normalizedTargetUrl,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    currentUrl: sessionGate.sessionSnapshot.currentUrl,
    allowReplay: input.profile.allowReplay,
    nowIsoTimestamp: reservationClock.isoTimestamp,
    nowMonotonicMs: reservationClock.monotonicMs,
    ttlMs: input.profile.idempotencyPolicy.ttlMs,
    maxReservations: input.profile.idempotencyPolicy.maxReservations,
  });
  if (!idempotency.ok) {
    const ended = input.context.clock.now();
    return buildOpenResult({
      request: input.request,
      profile: input.profile,
      targetPolicyDecision: targetPolicy.decision,
      urlSafetyDecision: urlSafety.decision,
      sessionDecision: sessionGate.decision,
      navigationDecision: {
        status: "review_required",
        reason: idempotency.reason,
        browserActionId: null,
        openedUrl: sessionGate.sessionSnapshot.currentUrl,
        pageTitleAfter: sessionGate.sessionSnapshot.currentTitle,
        navigationAttemptRef: `${idempotency.idempotencyKey}:duplicate`,
        navigationCallId: `${idempotency.idempotencyKey}:duplicate`,
        redirectChain: [normalizedTargetUrl],
        timeoutDecision: "within_limit",
        abortDecision: "not_requested",
        circuitBreakerState: "closed",
        browserOpenStillRunningGuard: false,
        alreadyOnTargetFreshnessDecision: idempotency.alreadyOnTargetDecision,
      },
      postOpenStateDecision: createPostOpenFailure("review_required", "unexpected_redirect", idempotency.reason),
      idempotencyKey: idempotency.idempotencyKey,
      idempotencyDecision: idempotency.decision,
      beforeSession: sessionGate.sessionSnapshot,
      afterSession: sessionGate.sessionSnapshot,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: null,
      reviewRequiredReason: idempotency.reason,
      dataQualityFlags: [makeDataFlag("duplicate_open", "warn", idempotency.reason ?? "duplicate open detected")],
      sessionSnapshotAvailable: true,
      sessionSnapshotFailureReason: null,
    });
  }

  const pageStateHandoffRef = `page-state:${input.request.runId}:${input.request.childCapabilityId}`;
  const navigation = await runOpenNavigation({
    browser: input.context.browser,
    request: input.request,
    profile: input.profile,
    targetUrl: normalizedTargetUrl,
    targetTitle: targetPolicy.resolvedTargetTitle ?? input.profile.defaultTitle,
    timeoutMs: resolveOpenTimeoutMs(input.profile),
    idempotencyKey: idempotency.idempotencyKey,
    reservationDecision: idempotency.decision === "already_on_target" ? "already_on_target" : "reserved",
    alreadyOnTargetDecision: idempotency.alreadyOnTargetDecision,
    targetProfileRef: targetPolicy.decision.targetProfileRef,
    beforeSession: sessionGate.sessionSnapshot,
  });

  const postOpenState = evaluatePostOpenState({
    profile: input.profile,
    beforeSession: sessionGate.sessionSnapshot,
    afterSession: navigation.afterSession,
    navigationDecision: navigation.decision,
    pageStateHandoffRef,
  });

  const ended = input.context.clock.now();
  if (postOpenState.status === "success") {
    input.context.idempotency.commitSuccess({ idempotencyKey: idempotency.idempotencyKey });
  } else if (idempotency.decision === "reserved") {
    input.context.idempotency.releaseOnFailure({ idempotencyKey: idempotency.idempotencyKey });
  }

  return OpenResultSchema.parse(buildOpenResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: targetPolicy.decision,
    urlSafetyDecision: urlSafety.decision,
    sessionDecision: sessionGate.decision,
    navigationDecision: navigation.decision,
    postOpenStateDecision: postOpenState.decision,
    idempotencyKey: idempotency.idempotencyKey,
    idempotencyDecision: idempotency.decision,
    beforeSession: sessionGate.sessionSnapshot,
    afterSession: navigation.afterSession,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    failureReason: postOpenState.status === "failed"
      ? createOpenFailure({
          code: navigation.failureCode ?? postOpenState.failureCode ?? "post_open_state_failed",
          message: postOpenState.reason ?? navigation.reason ?? "open failed after post-open state evaluation",
        })
      : null,
    reviewRequiredReason: postOpenState.status === "review_required" ? postOpenState.reason : null,
    dataQualityFlags: postOpenState.dataQualityFlags,
    sessionSnapshotAvailable: navigation.sessionSnapshotAvailable,
    sessionSnapshotFailureReason: navigation.sessionSnapshotFailureReason,
  }));
}