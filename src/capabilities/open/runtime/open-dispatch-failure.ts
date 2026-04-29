import type {
  BrowserSessionSnapshot,
  OpenDataQualityFlag,
  OpenResult,
} from "../contract.js";
import { OpenResultSchema, OpenRuntimeProofSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import type { OpenDispatchFailureTrace } from "./open-input-gate.js";

function createFallbackSession(): BrowserSessionSnapshot {
  return {
    open: false,
    currentUrl: "about:blank",
    currentTitle: null,
    browserExecutable: null,
    browserMode: "unsupported",
    browserProfileRef: "open-session:unavailable",
    browserExecutablePath: null,
    profileStatus: "profile_unavailable",
    profileDirectory: "unavailable",
    profileProvisioning: "managed_default",
    profileVerificationStatus: "default_unverified",
    profileVerificationReason: "session snapshot unavailable",
    loginState: "unknown",
    lastLoginCheckAt: null,
    loginRequiredReason: null,
    reviewRequiredReason: null,
  };
}

export function buildOpenDispatchFailure(input: {
  trace: OpenDispatchFailureTrace;
  failureCode: "unknown_child" | "input_schema_invalid" | "target_policy_blocked" | "url_policy_blocked" | "session_gate_blocked" | "session_snapshot_failed" | "navigation_timeout" | "navigation_failed" | "post_open_state_failed" | "child_execution_failed" | "duplicate_open_blocked";
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  reason: string;
  status: OpenResult["status"];
}): OpenResult {
  const session = createFallbackSession();
  const failureReason = createOpenFailure({ code: input.failureCode, message: input.reason });
  const dataQualityFlags: OpenDataQualityFlag[] = [{ code: "dispatch_failure", severity: "error", reason: input.reason }];
  const runtimeProof = OpenRuntimeProofSchema.parse({
    proofId: `open-proof:dispatch:${input.startedMonotonicMs}`,
    runId: input.trace.runId.value,
    missionId: input.trace.missionId.value,
    sessionId: input.trace.sessionId.value,
    roundId: input.trace.roundId,
    videoVisitId: input.trace.videoVisitId,
    abilityGroupId: "open",
    childCapabilityId: input.trace.childCapabilityId.value,
    platformId: input.trace.platformId.value,
    targetKind: input.trace.targetKind.value,
    sourceAbilityGroupId: input.trace.sourceAbilityGroupId,
    sourceChildCapabilityId: input.trace.sourceChildCapabilityId,
    inputRef: `open-dispatch:${input.startedMonotonicMs}:input`,
    outputRef: `open-dispatch:${input.endedMonotonicMs}:output`,
    targetProfileRef: null,
    targetUrl: input.trace.targetUrl.value,
    openedUrl: session.currentUrl,
    redirectChain: input.trace.targetUrl.value ? [input.trace.targetUrl.value] : [],
    browserProfileRef: session.browserProfileRef,
    browserMode: session.browserMode,
    profileVerificationStatus: session.profileVerificationStatus,
    loginStateBefore: session.loginState,
    loginStateAfter: session.loginState,
    pageTitleAfter: session.currentTitle,
    idempotencyKey: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
    navigationAttemptRef: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
    pageStateHandoffRequired: false,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs)),
    status: input.status,
    failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
    targetPolicyDecision: {
      status: "block",
      reason: input.reason,
      targetProfileRef: null,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
    },
    urlSafetyDecision: {
      status: "block",
      reason: input.failureCode === "input_schema_invalid" ? "input schema invalid prevented url safety evaluation" : input.reason,
      normalizedUrl: null,
      hostname: null,
      scheme: null,
    },
    sessionDecision: {
      status: "block",
      reason: input.reason,
      browserMode: session.browserMode,
      profileStatus: session.profileStatus,
      profileVerificationStatus: session.profileVerificationStatus,
    },
    navigationDecision: {
      status: "browser_failed",
      reason: input.reason,
      browserActionId: null,
      fallbackUsed: false,
      openedUrl: session.currentUrl,
      pageTitleAfter: session.currentTitle,
      navigationAttemptRef: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
      redirectChain: input.trace.targetUrl.value ? [input.trace.targetUrl.value] : [],
    },
    postOpenStateDecision: {
      status: input.status,
      classification: "unknown",
      reason: input.reason,
      openedUrl: session.currentUrl,
      pageTitleAfter: session.currentTitle,
      pageStateHandoffRequired: false,
    },
    dataQualityFlags,
    browserSessionRef: `browser-session:${session.browserProfileRef}`,
    sourceRef: input.trace.sourceRef ?? `${input.trace.sourceAbilityGroupId}:${input.trace.sourceChildCapabilityId ?? "dispatch-failure"}`,
    openAttemptRef: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
    pageStateRef: null,
    forensicsRef: null,
    missionIdSource: input.trace.missionId.source,
    runIdSource: input.trace.runId.source,
    sessionIdSource: input.trace.sessionId.source,
    targetUrlSource: input.trace.targetUrl.source,
    childCapabilityIdSource: input.trace.childCapabilityId.source,
    failureInputParseDecision: input.trace.parseDecision,
    clock: {
      portKind: "open-clock-port",
      startedMonotonicMs: input.startedMonotonicMs,
      endedMonotonicMs: input.endedMonotonicMs,
    },
  });

  return OpenResultSchema.parse({
    abilityGroupId: "open",
    childCapabilityId: input.trace.childCapabilityId.value,
    platformId: input.trace.platformId.value,
    targetKind: input.trace.targetKind.value,
    status: input.status,
    message: input.reason,
    targetUrl: input.trace.targetUrl.value,
    openedUrl: session.currentUrl,
    targetTitle: input.trace.targetTitle,
    pageTitleAfter: session.currentTitle,
    pageStateHandoffRequired: false,
    output: null,
    failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
    runtimeProof,
  });
}