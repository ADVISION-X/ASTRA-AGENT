import type {
  OpenChildExecutionContext,
  OpenResult,
  OpenTargetProfile,
  ParsedOpenRequest,
} from "../contract.js";
import { OpenResultSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildOpenResult } from "./open-result-builder.js";
import { evaluatePostOpenState } from "./post-open-state-gate.js";
import { evaluateRealChromeSession } from "./real-chrome-session-gate.js";
import { runOpenNavigation } from "./navigation-runner.js";
import { evaluateOpenTargetPolicy } from "./target-policy-gate.js";
import { resolveOpenTimeoutMs } from "./open-timeout-policy.js";
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
        normalizedUrl: targetPolicy.resolvedTargetUrl,
        hostname: "127.0.0.1",
        scheme: "http",
      },
      sessionDecision: {
        status: "block",
        reason: targetPolicy.reason,
        browserMode: unavailableSession.browserMode,
        profileStatus: unavailableSession.profileStatus,
        profileVerificationStatus: unavailableSession.profileVerificationStatus,
      },
      navigationDecision: {
        status: "browser_failed",
        reason: targetPolicy.reason,
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: null,
        pageTitleAfter: null,
        navigationAttemptRef: `${input.request.runId}:target-policy-blocked`,
        redirectChain: [targetPolicy.resolvedTargetUrl],
      },
      postOpenStateDecision: {
        status: "failed",
        classification: "unknown",
        reason: targetPolicy.reason,
        openedUrl: null,
        pageTitleAfter: null,
        pageStateHandoffRequired: false,
      },
      idempotencyKey: `${input.request.runId}:target-policy-blocked`,
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
      dataQualityFlags: ["target_policy_blocked"],
    });
  }

  const urlSafety = evaluateUrlSafety({
    profile: input.profile,
    targetUrl: targetPolicy.resolvedTargetUrl,
  });
  if (!urlSafety.ok) {
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
        status: "browser_failed",
        reason: urlSafety.reason,
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: null,
        pageTitleAfter: null,
        navigationAttemptRef: `${input.request.runId}:url-safety-blocked`,
        redirectChain: [targetPolicy.resolvedTargetUrl],
      },
      postOpenStateDecision: {
        status: "failed",
        classification: "wrong_domain",
        reason: urlSafety.reason,
        openedUrl: null,
        pageTitleAfter: null,
        pageStateHandoffRequired: false,
      },
      idempotencyKey: `${input.request.runId}:url-safety-blocked`,
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
      dataQualityFlags: ["url_policy_blocked"],
    });
  }

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
        status: "browser_failed",
        reason: sessionGate.reason,
        browserActionId: null,
        fallbackUsed: false,
        openedUrl: fallbackSession.currentUrl,
        pageTitleAfter: fallbackSession.currentTitle,
        navigationAttemptRef: `${input.request.runId}:session-gate-blocked`,
        redirectChain: [urlSafety.normalizedUrl],
      },
      postOpenStateDecision: {
        status: sessionGate.status,
        classification: sessionGate.status === "review_required" ? "security_wall" : "unknown",
        reason: sessionGate.reason,
        openedUrl: fallbackSession.currentUrl,
        pageTitleAfter: fallbackSession.currentTitle,
        pageStateHandoffRequired: false,
      },
      idempotencyKey: `${input.request.runId}:session-gate-blocked`,
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
      dataQualityFlags: [sessionGate.failureCode ?? "session_gate_blocked"],
    });
  }

  const idempotency = input.context.reserveIdempotency({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: urlSafety.normalizedUrl,
    roundId: input.request.roundId,
    currentUrl: sessionGate.sessionSnapshot.currentUrl,
    allowReplay: input.profile.allowReplay,
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
        fallbackUsed: false,
        openedUrl: sessionGate.sessionSnapshot.currentUrl,
        pageTitleAfter: sessionGate.sessionSnapshot.currentTitle,
        navigationAttemptRef: `${idempotency.idempotencyKey}:duplicate`,
        redirectChain: [urlSafety.normalizedUrl],
      },
      postOpenStateDecision: {
        status: "review_required",
        classification: "unexpected_redirect",
        reason: idempotency.reason,
        openedUrl: sessionGate.sessionSnapshot.currentUrl,
        pageTitleAfter: sessionGate.sessionSnapshot.currentTitle,
        pageStateHandoffRequired: false,
      },
      idempotencyKey: idempotency.idempotencyKey,
      beforeSession: sessionGate.sessionSnapshot,
      afterSession: sessionGate.sessionSnapshot,
      startedAt: started.isoTimestamp,
      endedAt: ended.isoTimestamp,
      startedMonotonicMs: started.monotonicMs,
      endedMonotonicMs: ended.monotonicMs,
      failureReason: null,
      reviewRequiredReason: idempotency.reason,
      dataQualityFlags: ["duplicate_open"],
    });
  }

  const navigation = await runOpenNavigation({
    browser: input.context.browser,
    targetUrl: urlSafety.normalizedUrl,
    targetTitle: targetPolicy.resolvedTargetTitle,
    timeoutMs: resolveOpenTimeoutMs(input.profile),
    idempotencyKey: idempotency.idempotencyKey,
    reservationStatus: idempotency.status === "already_on_target" ? "already_on_target" : "reserved",
    beforeSession: sessionGate.sessionSnapshot,
  });

  const postOpenState = evaluatePostOpenState({
    profile: input.profile,
    beforeSession: sessionGate.sessionSnapshot,
    afterSession: navigation.afterSession,
    navigationDecision: navigation.decision,
  });

  const ended = input.context.clock.now();
  return OpenResultSchema.parse(buildOpenResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: targetPolicy.decision,
    urlSafetyDecision: urlSafety.decision,
    sessionDecision: sessionGate.decision,
    navigationDecision: navigation.decision,
    postOpenStateDecision: postOpenState.decision,
    idempotencyKey: idempotency.idempotencyKey,
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
  }));
}