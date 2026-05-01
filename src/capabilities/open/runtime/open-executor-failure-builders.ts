import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenFailure,
  OpenNavigationDecision,
  OpenResult,
  OpenSessionDecision,
  OpenTargetPolicyDecision,
  OpenTargetProfile,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
  PostOpenStateDecision,
} from "../contract.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildOpenResult } from "./open-result-builder.js";

type ClockSnapshot = { isoTimestamp: string; monotonicMs: number };
type OpenIdempotencyDecision = "reserved" | "duplicate_review_required" | "already_on_target" | "scope_capacity_exceeded" | "not_started";

export function createUnavailableSession(reason: string) {
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

export function makeDataFlag(code: string, severity: OpenDataQualityFlag["severity"], reason: string): OpenDataQualityFlag {
  return { code, severity, reason };
}

export function createPostOpenFailure(status: OpenResult["status"], classification: "unknown" | "wrong_domain" | "security_wall" | "unexpected_redirect", reason: string | null) {
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

function buildBlockedUrlSafetyDecision(reason: string | null): OpenUrlSafetyDecision {
  return {
    status: "block",
    reason,
    normalizedUrl: null,
    hostname: null,
    scheme: null,
  };
}

function buildBlockedSessionDecision(input: {
  reason: string | null;
  browserMode: OpenSessionDecision["browserMode"];
  profileStatus: OpenSessionDecision["profileStatus"];
  profileVerificationStatus: OpenSessionDecision["profileVerificationStatus"];
}): OpenSessionDecision {
  return {
    status: "block",
    reason: input.reason,
    browserMode: input.browserMode,
    profileStatus: input.profileStatus,
    profileVerificationStatus: input.profileVerificationStatus,
  };
}

function buildBlockedNavigationDecision(input: {
  reason: string | null;
  navigationAttemptRef: string;
  navigationCallId: string;
  openedUrl: string | null;
  pageTitleAfter: string | null;
  redirectChain: string[];
  alreadyOnTargetFreshnessDecision: "not_applicable" | "freshness_required" | "freshness_verified";
}): OpenNavigationDecision {
  return {
    status: "failed",
    reason: input.reason,
    browserActionId: null,
    openedUrl: input.openedUrl,
    pageTitleAfter: input.pageTitleAfter,
    navigationAttemptRef: input.navigationAttemptRef,
    navigationCallId: input.navigationCallId,
    redirectChain: input.redirectChain,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    browserOpenStillRunningGuard: false,
    alreadyOnTargetFreshnessDecision: input.alreadyOnTargetFreshnessDecision,
  };
}

export function buildFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  targetPolicyDecision: OpenTargetPolicyDecision;
  urlSafetyDecision: OpenUrlSafetyDecision;
  sessionDecision: OpenSessionDecision;
  navigationDecision: OpenNavigationDecision;
  postOpenStateDecision: PostOpenStateDecision;
  idempotencyKey: string;
  idempotencyDecision: OpenIdempotencyDecision;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  failureReason: OpenFailure | null;
  reviewRequiredReason: string | null;
  dataQualityFlags: OpenDataQualityFlag[];
  sessionSnapshotAvailable: boolean;
  sessionSnapshotFailureReason: string | null;
}): OpenResult {
  return buildOpenResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: input.urlSafetyDecision,
    sessionDecision: input.sessionDecision,
    navigationDecision: input.navigationDecision,
    postOpenStateDecision: input.postOpenStateDecision,
    idempotencyKey: input.idempotencyKey,
    idempotencyDecision: input.idempotencyDecision,
    beforeSession: input.beforeSession,
    afterSession: input.afterSession,
    startedAt: input.startedAt.isoTimestamp,
    endedAt: input.endedAt.isoTimestamp,
    startedMonotonicMs: input.startedAt.monotonicMs,
    endedMonotonicMs: input.endedAt.monotonicMs,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    dataQualityFlags: input.dataQualityFlags,
    sessionSnapshotAvailable: input.sessionSnapshotAvailable,
    sessionSnapshotFailureReason: input.sessionSnapshotFailureReason,
  });
}

export function buildTargetPolicyFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  targetPolicyDecision: OpenTargetPolicyDecision;
  reason: string | null;
}) {
  const unavailableSession = createUnavailableSession(input.reason ?? "target policy blocked");
  return buildFailureResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: buildBlockedUrlSafetyDecision(input.reason),
    sessionDecision: buildBlockedSessionDecision({
      reason: input.reason,
      browserMode: unavailableSession.browserMode,
      profileStatus: unavailableSession.profileStatus,
      profileVerificationStatus: unavailableSession.profileVerificationStatus,
    }),
    navigationDecision: buildBlockedNavigationDecision({
      reason: input.reason,
      navigationAttemptRef: `${input.request.runId}:target-policy-blocked`,
      navigationCallId: `${input.request.runId}:target-policy-blocked`,
      openedUrl: null,
      pageTitleAfter: null,
      redirectChain: [],
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
    postOpenStateDecision: createPostOpenFailure("failed", "unknown", input.reason),
    idempotencyKey: `${input.request.runId}:target-policy-blocked`,
    idempotencyDecision: "not_started",
    beforeSession: unavailableSession,
    afterSession: unavailableSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: createOpenFailure({
      code: "target_policy_blocked",
      message: input.reason ?? "open target policy blocked",
    }),
    reviewRequiredReason: null,
    dataQualityFlags: [makeDataFlag("target_policy_blocked", "error", input.reason ?? "open target policy blocked")],
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: "target policy blocked before session evaluation",
  });
}

export function buildInvalidAllowFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  targetPolicyDecision: OpenTargetPolicyDecision;
}) {
  const reason = "target policy allow decision did not provide a resolved target url";
  const unavailableSession = createUnavailableSession(reason);
  return buildFailureResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: buildBlockedUrlSafetyDecision(reason),
    sessionDecision: buildBlockedSessionDecision({
      reason,
      browserMode: unavailableSession.browserMode,
      profileStatus: unavailableSession.profileStatus,
      profileVerificationStatus: unavailableSession.profileVerificationStatus,
    }),
    navigationDecision: buildBlockedNavigationDecision({
      reason,
      navigationAttemptRef: `${input.request.runId}:target-policy-invalid-allow`,
      navigationCallId: `${input.request.runId}:target-policy-invalid-allow`,
      openedUrl: null,
      pageTitleAfter: null,
      redirectChain: [],
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
    postOpenStateDecision: createPostOpenFailure("failed", "unknown", reason),
    idempotencyKey: `${input.request.runId}:target-policy-invalid-allow`,
    idempotencyDecision: "not_started",
    beforeSession: unavailableSession,
    afterSession: unavailableSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: createOpenFailure({
      code: "target_policy_blocked",
      message: reason,
    }),
    reviewRequiredReason: null,
    dataQualityFlags: [makeDataFlag("target_policy_blocked", "error", reason)],
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: reason,
  });
}

export function buildUrlSafetyFailureResult(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  startedAt: ClockSnapshot;
  endedAt: ClockSnapshot;
  targetPolicyDecision: OpenTargetPolicyDecision;
  reason: string | null;
}) {
  const unavailableSession = createUnavailableSession(input.reason ?? "url safety blocked");
  const redirectChain = input.targetPolicyDecision.resolvedTargetUrl ? [input.targetPolicyDecision.resolvedTargetUrl] : [];
  return buildFailureResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: input.targetPolicyDecision,
    urlSafetyDecision: buildBlockedUrlSafetyDecision(input.reason),
    sessionDecision: buildBlockedSessionDecision({
      reason: input.reason,
      browserMode: unavailableSession.browserMode,
      profileStatus: unavailableSession.profileStatus,
      profileVerificationStatus: unavailableSession.profileVerificationStatus,
    }),
    navigationDecision: buildBlockedNavigationDecision({
      reason: input.reason,
      navigationAttemptRef: `${input.request.runId}:url-safety-blocked`,
      navigationCallId: `${input.request.runId}:url-safety-blocked`,
      openedUrl: null,
      pageTitleAfter: null,
      redirectChain,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    }),
    postOpenStateDecision: createPostOpenFailure("failed", "wrong_domain", input.reason),
    idempotencyKey: `${input.request.runId}:url-safety-blocked`,
    idempotencyDecision: "not_started",
    beforeSession: unavailableSession,
    afterSession: unavailableSession,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    failureReason: createOpenFailure({
      code: "url_policy_blocked",
      message: input.reason ?? "open url safety blocked",
    }),
    reviewRequiredReason: null,
    dataQualityFlags: [makeDataFlag("url_policy_blocked", "error", input.reason ?? "open url safety blocked")],
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: "url policy blocked before session evaluation",
  });
}

