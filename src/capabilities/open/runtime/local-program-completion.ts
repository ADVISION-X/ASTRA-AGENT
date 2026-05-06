import type { OpenDataQualityFlag, OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import { createOpenFailure } from "../shared/open-failure.js";
import { resolveLocalProgramFailureCode } from "./local-program-failure.js";
import { buildLocalProgramNavigationDecision, buildLocalProgramPostOpenDecision, resolveHandoffRefs } from "./local-program-handoff.js";
import { readLocalProgramSnapshot, runLocalProgramLaunch } from "./local-program-launch.js";
import { createUnavailableSession, makeDataFlag } from "./open-executor-failure-builders.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { buildOpenResult } from "./open-result-builder.js";
import { resolveOpenTimeoutMs } from "./open-timeout-policy.js";

type LocalProgramProfile = Extract<OpenTargetProfile, { targetKind: "local-program" }>;
type ClockSnapshot = ReturnType<OpenChildExecutionContext["clock"]["now"]>;
type LocalProgramCompletionInput = {
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  context: OpenChildExecutionContext;
  targetPolicyDecision: Parameters<typeof buildOpenResult>[0]["targetPolicyDecision"];
  started: ClockSnapshot;
};

const buildLocalProgramDataQualityFlags = (input: { status: OpenResult["status"]; reason: string | null }): OpenDataQualityFlag[] =>
  input.status === "success" ? [] : [makeDataFlag("local_program_open_failed", "error", input.reason ?? "local program open failed")];

const reserveLocalProgramOpen = (input: LocalProgramCompletionInput, reservationClock: ClockSnapshot) =>
  input.context.idempotency.reserve({
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

const finalizeLocalProgramIdempotency = (input: {
  context: OpenChildExecutionContext;
  idempotencyKey: string;
  idempotencyDecision: string;
  success: boolean;
}): void => {
  if (input.success) input.context.idempotency.commitSuccess({ idempotencyKey: input.idempotencyKey });
  if (!input.success && input.idempotencyDecision === "reserved") input.context.idempotency.releaseOnFailure({ idempotencyKey: input.idempotencyKey });
};

const buildLocalProgramFailureMessage = (launchReason: string | null, snapshotFailureReason: string | null | undefined): string =>
  launchReason ?? snapshotFailureReason ?? "local program open did not produce required handoff refs";

async function resolveLocalProgramCompletionState(input: LocalProgramCompletionInput) {
  const reservationClock = input.context.clock.now();
  const idempotency = reserveLocalProgramOpen(input, reservationClock);
  const timeoutMs = resolveOpenTimeoutMs(input.profile);
  const launch = idempotency.ok ? await runLocalProgramLaunch({ ...input, idempotencyKey: idempotency.idempotencyKey, timeoutMs }) : { launchResult: null, timedOut: false, reason: idempotency.reason, failureCode: null };
  const snapshot = await readLocalProgramSnapshot({ context: input.context, profile: input.profile, launchResult: launch.launchResult });
  const handoff = resolveHandoffRefs({ launchResult: launch.launchResult, snapshot });
  const success = idempotency.ok && launch.launchResult?.ok === true && handoff.windowHandoffRef !== null && handoff.localAppStateHandoffRef !== null;
  return { idempotency, launch, snapshot, handoff, success };
}

function buildCompletedLocalProgramOpenResult(input: {
  completion: LocalProgramCompletionInput;
  state: Awaited<ReturnType<typeof resolveLocalProgramCompletionState>>;
  ended: ClockSnapshot;
}): OpenResult {
  const { completion, state } = input;
  const { idempotency, launch, snapshot, handoff, success } = state;
  const status: OpenResult["status"] = success ? "success" : "failed";
  const failureCode = success ? null : resolveLocalProgramFailureCode({ idempotencyOk: idempotency.ok, launch, handoff });
  const pageStateHandoffRef = success ? `page-state:${completion.request.runId}:${completion.request.childCapabilityId}` : null;
  const failureReason = buildLocalProgramFailureMessage(launch.reason, snapshot?.snapshotFailureReason);
  const postOpenStateDecision = buildLocalProgramPostOpenDecision({ status, reason: success ? null : failureReason, pageStateHandoffRef });
  const unavailableSession = createUnavailableSession("local program branch does not use browser session");
  return buildOpenResult({ request: completion.request, profile: completion.profile, targetPolicyDecision: completion.targetPolicyDecision, urlSafetyDecision: { status: "not_applicable", reason: "local program open does not use URL safety gate", normalizedUrl: null, hostname: null, scheme: null }, sessionDecision: { status: "allow", reason: "local program open does not require a browser session", browserMode: "unsupported", profileStatus: "profile_unavailable", profileVerificationStatus: "default_unverified" }, navigationDecision: buildLocalProgramNavigationDecision({ idempotencyKey: idempotency.idempotencyKey, launchResult: launch.launchResult, timedOut: launch.timedOut, reason: launch.reason }), postOpenStateDecision, idempotencyKey: idempotency.idempotencyKey, idempotencyDecision: idempotency.decision, beforeSession: unavailableSession, afterSession: unavailableSession, startedAt: completion.started.isoTimestamp, endedAt: input.ended.isoTimestamp, startedMonotonicMs: completion.started.monotonicMs, endedMonotonicMs: input.ended.monotonicMs, failureReason: success ? null : createOpenFailure({ code: failureCode ?? "LOCAL_PROGRAM_LAUNCH_FAILED", message: launch.reason ?? "local program open failed" }), reviewRequiredReason: null, dataQualityFlags: buildLocalProgramDataQualityFlags({ status, reason: launch.reason }), sessionSnapshotAvailable: false, sessionSnapshotFailureReason: "local program branch does not use browser session", localProgramOpenAttemptRef: `${idempotency.idempotencyKey}:local-program-open-attempt`, appLaunchAttemptRef: launch.launchResult?.appLaunchAttemptRef ?? null, appName: completion.profile.appName, bundleId: completion.profile.bundleId, appPath: completion.profile.appPath, allowedLaunchMethod: completion.profile.allowedLaunchMethod, windowHandoffRef: handoff.windowHandoffRef, localAppStateHandoffRef: handoff.localAppStateHandoffRef, localProgramSnapshotAvailable: snapshot?.visibleWindowAvailable ?? false, localProgramSnapshotFailureReason: snapshot?.snapshotFailureReason ?? null });
}

export async function completeLocalProgramOpen(input: LocalProgramCompletionInput): Promise<OpenResult> {
  const state = await resolveLocalProgramCompletionState(input);
  const ended = input.context.clock.now();
  finalizeLocalProgramIdempotency({
    context: input.context,
    idempotencyKey: state.idempotency.idempotencyKey,
    idempotencyDecision: state.idempotency.decision,
    success: state.success,
  });
  return buildCompletedLocalProgramOpenResult({ completion: input, state, ended });
}
