import type { OpenDataQualityFlag, OpenResult } from "../contract.js";
import { OpenResultSchema, OpenRuntimeProofSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import type { OpenDispatchFailureTrace } from "./open-input-gate.js";

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
  const failureReason = createOpenFailure({ code: input.failureCode, message: input.reason });
  const dataQualityFlags: OpenDataQualityFlag[] = [{ code: "dispatch_failure", severity: "error", reason: input.reason }];
  const idempotencyKey = `${input.trace.runId.value ?? "no-run"}:dispatch-failure`;
  const navigationAttemptRef = `${input.trace.runId.value ?? "no-run"}:dispatch-failure`;

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
    missionIdSource: input.trace.missionId.source,
    runIdSource: input.trace.runId.source,
    sessionIdSource: input.trace.sessionId.source,
    childCapabilityIdSource: input.trace.childCapabilityId.source,
    failureInputParseDecision: input.trace.parseDecision,
    inputRef: `open-dispatch:${input.startedMonotonicMs}:input`,
    outputRef: null,
    diagnosticPayloadRef: `open-dispatch:${input.endedMonotonicMs}:diagnostic`,
    targetProfileRef: null,
    targetUrl: input.trace.targetUrl.value,
    targetUrlSource: input.trace.targetUrl.value ? "provided" : "rejected_missing",
    openedUrl: null,
    redirectChain: input.trace.targetUrl.value ? [input.trace.targetUrl.value] : [],
    browserProfileRef: null,
    browserMode: "unsupported",
    profileVerificationStatus: "default_unverified",
    loginStateBefore: "unknown",
    loginStateAfter: "unknown",
    pageTitleAfter: null,
    idempotencyKey,
    idempotencyDecision: "not_started",
    openAttemptRef: navigationAttemptRef,
    navigationCallId: navigationAttemptRef,
    navigationAttemptRef,
    timeoutDecision: "within_limit",
    abortDecision: "not_requested",
    circuitBreakerState: "closed",
    targetPolicyDecision: {
      status: "block",
      reason: input.reason,
      targetProfileRef: null,
      resolvedTargetUrl: null,
      resolvedTargetTitle: null,
      targetUrlSource: "rejected_missing",
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
      browserMode: "unsupported",
      profileStatus: "profile_unavailable",
      profileVerificationStatus: "default_unverified",
    },
    navigationDecision: {
      status: "failed",
      reason: input.reason,
      browserActionId: null,
      openedUrl: null,
      pageTitleAfter: null,
      navigationAttemptRef,
      navigationCallId: navigationAttemptRef,
      redirectChain: input.trace.targetUrl.value ? [input.trace.targetUrl.value] : [],
      timeoutDecision: "within_limit",
      abortDecision: "not_requested",
      circuitBreakerState: "closed",
      browserOpenStillRunningGuard: false,
      alreadyOnTargetFreshnessDecision: "not_applicable",
    },
    postOpenDecision: {
      status: input.status,
      classification: "unknown",
      reason: input.reason,
      openedUrl: null,
      pageTitleAfter: null,
      pageStateHandoffRequired: false,
      pageStateHandoffRef: null,
      authoritative: false,
      documentReadyState: null,
    },
    preliminaryOpenClassification: "unknown",
    pageStateHandoffRequired: false,
    pageStateHandoffRef: null,
    sourceRef: input.trace.sourceRef ?? `${input.trace.sourceAbilityGroupId}:${input.trace.sourceChildCapabilityId ?? "dispatch-failure"}`,
    sessionSnapshotAvailable: false,
    sessionSnapshotFailureReason: "dispatch failed before any trusted session snapshot could be recorded",
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs)),
    status: input.status,
    failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
    dataQualityFlags,
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
    openedUrl: null,
    targetTitle: input.trace.targetTitle,
    pageTitleAfter: null,
    pageStateHandoffRequired: false,
    output: null,
    failureReason,
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
    runtimeProof,
  });
}