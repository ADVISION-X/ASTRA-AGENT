import type {
  OpenDataQualityFlag,
  OpenNavigationDecision,
  OpenResult,
  OpenSessionDecision,
  OpenTargetProfile,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
  PostOpenStateDecision,
} from "../contract.js";
import type { OpenLocalProgramLaunchResult, OpenLocalProgramSnapshot } from "../ports/open-local-program-port.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { buildTargetPolicyFailureResult, createUnavailableSession, makeDataFlag } from "./open-execution-builders.js";
import { evaluateOpenTargetPolicy } from "./target-policy-gate.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { resolveOpenTimeoutMs } from "./open-timeout-policy.js";
import { buildOpenResult } from "./open-result-builder.js";
import { runWithTimeout } from "./navigation-runner-support.js";

type LocalProgramProfile = Extract<OpenTargetProfile, { targetKind: "local-program" }>;
type ClockSnapshot = ReturnType<OpenChildExecutionContext["clock"]["now"]>;

const LOCAL_PROGRAM_URL_SAFETY_DECISION: OpenUrlSafetyDecision = {
  status: "not_applicable",
  reason: "local program open does not use URL safety gate",
  normalizedUrl: null,
  hostname: null,
  scheme: null,
};

const LOCAL_PROGRAM_SESSION_DECISION: OpenSessionDecision = {
  status: "allow",
  reason: "local program open does not require a browser session",
  browserMode: "unsupported",
  profileStatus: "profile_unavailable",
  profileVerificationStatus: "default_unverified",
};

function buildLocalProgramNavigationDecision(input: {
  idempotencyKey: string;
  launchResult: OpenLocalProgramLaunchResult | null;
  timedOut: boolean;
  reason: string | null;
}): OpenNavigationDecision {
  const status = input.timedOut ? "timed_out" : input.launchResult?.ok ? "executed" : "failed";
  return {
    status,
    reason: input.reason,
    browserActionId: input.launchResult?.localProgramActionId ?? null,
    openedUrl: null,
    pageTitleAfter: null,
    navigationAttemptRef: `${input.idempotencyKey}:local-program-open-attempt`,
    navigationCallId: `${input.idempotencyKey}:local-program-open-call`,
    redirectChain: [],
    timeoutDecision: input.timedOut ? "timed_out" : "within_limit",
    abortDecision: input.timedOut ? "timeout_abort_requested" : "not_requested",
    circuitBreakerState: "closed",
    browserOpenStillRunningGuard: input.timedOut,
    alreadyOnTargetFreshnessDecision: "not_applicable",
  };
}

function buildLocalProgramPostOpenDecision(input: {
  status: OpenResult["status"];
  reason: string | null;
  windowHandoffRef: string | null;
  localAppStateHandoffRef: string | null;
  pageStateHandoffRef: string | null;
}): PostOpenStateDecision {
  return {
    status: input.status,
    classification: "local_program",
    reason: input.reason,
    openedUrl: null,
    pageTitleAfter: null,
    pageStateHandoffRequired: true,
    pageStateHandoffRef: input.status === "success" ? input.pageStateHandoffRef : null,
    authoritative: false,
    documentReadyState: null,
  };
}

async function runLocalProgramLaunch(input: {
  context: OpenChildExecutionContext;
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  idempotencyKey: string;
  timeoutMs: number;
}): Promise<{ launchResult: OpenLocalProgramLaunchResult | null; timedOut: boolean; reason: string | null }> {
  if (!input.context.localProgram) {
    return {
      launchResult: null,
      timedOut: false,
      reason: "OpenLocalProgramPort is not configured",
    };
  }

  const abortController = new AbortController();
  try {
    const launchResult = await runWithTimeout({
      operation: input.context.localProgram.openLocalProgram({
        openAttemptRef: `${input.idempotencyKey}:local-program-open-attempt`,
        missionId: input.request.missionId,
        runId: input.request.runId,
        sessionId: input.request.sessionId,
        roundId: input.request.roundId,
        videoVisitId: input.request.videoVisitId,
        childCapabilityId: "open-local-program",
        platformId: "macos-local",
        targetKind: "local-program",
        targetProfileRef: input.profile.targetProfileRef,
        appName: input.profile.appName,
        bundleId: input.profile.bundleId,
        appPath: input.profile.appPath,
        allowedLaunchMethod: input.profile.allowedLaunchMethod,
        timeoutMs: input.timeoutMs,
        abortSignal: abortController.signal,
        idempotencyKey: input.idempotencyKey,
        sourceRef: input.request.sourceRef,
      }),
      abortController,
      timeoutMs: input.timeoutMs,
    });
    return { launchResult, timedOut: false, reason: launchResult.ok ? null : launchResult.message };
  } catch (error) {
    return {
      launchResult: null,
      timedOut: true,
      reason: error instanceof Error ? error.message : "local program open timed out",
    };
  }
}

async function readLocalProgramSnapshot(input: {
  context: OpenChildExecutionContext;
  profile: LocalProgramProfile;
  launchResult: OpenLocalProgramLaunchResult | null;
}): Promise<OpenLocalProgramSnapshot | null> {
  if (!input.context.localProgram || !input.launchResult?.ok) {
    return null;
  }

  return input.context.localProgram.getLocalProgramSnapshot({
    targetProfileRef: input.profile.targetProfileRef,
    appName: input.profile.appName,
    bundleId: input.profile.bundleId,
  });
}

function resolveHandoffRefs(input: {
  launchResult: OpenLocalProgramLaunchResult | null;
  snapshot: OpenLocalProgramSnapshot | null;
}) {
  return {
    windowHandoffRef: input.snapshot?.windowHandoffRef ?? input.launchResult?.windowHandoffRef ?? null,
    localAppStateHandoffRef: input.snapshot?.localAppStateHandoffRef ?? input.launchResult?.localAppStateHandoffRef ?? null,
  };
}

function buildLocalProgramDataQualityFlags(input: {
  status: OpenResult["status"];
  reason: string | null;
}): OpenDataQualityFlag[] {
  return input.status === "success"
    ? []
    : [makeDataFlag("local_program_open_failed", "error", input.reason ?? "local program open failed")];
}

export async function executeOpenLocalProgramChildFlow(input: {
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
  const started = input.context.clock.now();
  const targetPolicy = evaluateOpenTargetPolicy({
    request: input.request,
    profile: input.profile,
    profileOverride: null,
  });
  if (!targetPolicy.ok) {
    return buildTargetPolicyFailureResult({
      request: input.request,
      profile: input.profile,
      startedAt: started,
      endedAt: input.context.clock.now(),
      targetPolicyDecision: targetPolicy.decision,
      reason: targetPolicy.reason,
    });
  }

  const reservationClock = input.context.clock.now();
  const idempotency = input.context.idempotency.reserve({
    sessionId: input.request.sessionId,
    childCapabilityId: input.request.childCapabilityId,
    targetUrl: input.profile.targetProfileRef,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    currentUrl: input.profile.targetProfileRef,
    allowReplay: input.profile.allowReplay,
    nowIsoTimestamp: reservationClock.isoTimestamp,
    nowMonotonicMs: reservationClock.monotonicMs,
    ttlMs: input.profile.idempotencyPolicy.ttlMs,
    maxReservations: input.profile.idempotencyPolicy.maxReservations,
  });

  const timeoutMs = resolveOpenTimeoutMs(input.profile);
  const launch = idempotency.ok
    ? await runLocalProgramLaunch({ ...input, idempotencyKey: idempotency.idempotencyKey, timeoutMs })
    : { launchResult: null, timedOut: false, reason: idempotency.reason };
  const snapshot = await readLocalProgramSnapshot({ context: input.context, profile: input.profile, launchResult: launch.launchResult });
  const handoff = resolveHandoffRefs({ launchResult: launch.launchResult, snapshot });
  const success = idempotency.ok && launch.launchResult?.ok === true && handoff.windowHandoffRef !== null && handoff.localAppStateHandoffRef !== null;
  const status: OpenResult["status"] = success ? "success" : "failed";
  const pageStateHandoffRef = success ? `page-state:${input.request.runId}:${input.request.childCapabilityId}` : null;
  const postOpenStateDecision = buildLocalProgramPostOpenDecision({
    status,
    reason: success ? null : launch.reason ?? snapshot?.snapshotFailureReason ?? "local program open did not produce required handoff refs",
    windowHandoffRef: handoff.windowHandoffRef,
    localAppStateHandoffRef: handoff.localAppStateHandoffRef,
    pageStateHandoffRef,
  });
  const ended: ClockSnapshot = input.context.clock.now();

  if (success) {
    input.context.idempotency.commitSuccess({ idempotencyKey: idempotency.idempotencyKey });
  } else if (idempotency.decision === "reserved") {
    input.context.idempotency.releaseOnFailure({ idempotencyKey: idempotency.idempotencyKey });
  }

  const unavailableSession = createUnavailableSession("local program branch does not use browser session");
  return buildOpenResult({
    request: input.request,
    profile: input.profile,
    targetPolicyDecision: targetPolicy.decision,
    urlSafetyDecision: LOCAL_PROGRAM_URL_SAFETY_DECISION,
    sessionDecision: LOCAL_PROGRAM_SESSION_DECISION,
    navigationDecision: buildLocalProgramNavigationDecision({
      idempotencyKey: idempotency.idempotencyKey,
      launchResult: launch.launchResult,
      timedOut: launch.timedOut,
      reason: launch.reason,
    }),
    postOpenStateDecision,
    idempotencyKey: idempotency.idempotencyKey,
    idempotencyDecision: idempotency.decision,
    beforeSession: unavailableSession,
    afterSession: unavailableSession,
    startedAt: started.isoTimestamp,
    endedAt: ended.isoTimestamp,
    startedMonotonicMs: started.monotonicMs,
    endedMonotonicMs: ended.monotonicMs,
    failureReason: success ? null : createOpenFailure({
      code: idempotency.ok ? "post_open_state_failed" : "idempotency_duplicate",
      message: launch.reason ?? "local program open failed",
    }),
    reviewRequiredReason: null,
    dataQualityFlags: buildLocalProgramDataQualityFlags({ status, reason: launch.reason }),
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: "local program branch does not use browser session",
    localProgramOpenAttemptRef: `${idempotency.idempotencyKey}:local-program-open-attempt`,
    appLaunchAttemptRef: launch.launchResult?.appLaunchAttemptRef ?? null,
    appName: input.profile.appName,
    bundleId: input.profile.bundleId,
    appPath: input.profile.appPath,
    allowedLaunchMethod: input.profile.allowedLaunchMethod,
    windowHandoffRef: handoff.windowHandoffRef,
    localAppStateHandoffRef: handoff.localAppStateHandoffRef,
    localProgramSnapshotAvailable: snapshot?.visibleWindowAvailable ?? false,
    localProgramSnapshotFailureReason: snapshot?.snapshotFailureReason ?? null,
  });
}
