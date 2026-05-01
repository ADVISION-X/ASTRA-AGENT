import type { OpenDataQualityFlag, OpenFailure, OpenResult, OpenRuntimeProof } from "../contract.js";
import { OpenResultSchema, OpenRuntimeProofSchema } from "../schema.js";
import { createOpenFailure } from "../shared/open-failure.js";
import type { OpenDispatchFailureTrace } from "./open-input-gate.js";

export type OpenDispatchFailureInput = {
  trace: OpenDispatchFailureTrace;
  failureCode:
    | "unknown_child"
    | "input_schema_invalid"
    | "target_policy_blocked"
    | "url_policy_blocked"
    | "session_gate_blocked"
    | "session_snapshot_failed"
    | "navigation_timeout"
    | "navigation_failed"
    | "post_open_state_failed"
    | "child_execution_failed"
    | "duplicate_open_blocked";
  startedAt: string;
  endedAt: string;
  startedMonotonicMs: number;
  endedMonotonicMs: number;
  reason: string;
  status: OpenResult["status"];
};

type OpenDispatchFailureDerivedState = {
  failureReason: OpenFailure;
  dataQualityFlags: OpenDataQualityFlag[];
  idempotencyKey: string;
  navigationAttemptRef: string;
  redirectChain: string[];
  sourceRef: string;
};

export const buildOpenDispatchFailureDerivedState = (
  input: OpenDispatchFailureInput,
): OpenDispatchFailureDerivedState => {
  const redirectChain = input.trace.targetUrl.value ? [input.trace.targetUrl.value] : [];
  return {
    failureReason: createOpenFailure({ code: input.failureCode, message: input.reason }),
    dataQualityFlags: [{ code: "dispatch_failure", severity: "error", reason: input.reason }],
    idempotencyKey: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
    navigationAttemptRef: `${input.trace.runId.value ?? "no-run"}:dispatch-failure`,
    redirectChain,
    sourceRef:
      input.trace.sourceRef ?? `${input.trace.sourceAbilityGroupId}:${input.trace.sourceChildCapabilityId ?? "dispatch-failure"}`,
  };
};

const buildOpenDispatchFailureTargetPolicyDecision = (input: OpenDispatchFailureInput) => ({
  status: "block" as const,
  reason: input.reason,
  targetProfileRef: null,
  resolvedTargetUrl: null,
  resolvedTargetTitle: null,
  targetUrlSource: "rejected_missing" as const,
});

const buildOpenDispatchFailureUrlSafetyDecision = (input: OpenDispatchFailureInput) => {
  const reason = input.failureCode === "input_schema_invalid"
    ? "input schema invalid prevented url safety evaluation"
    : input.reason;

  return {
    status: "block" as const,
    reason,
    normalizedUrl: null,
    hostname: null,
    scheme: null,
  };
};

const buildOpenDispatchFailureSessionDecision = (input: OpenDispatchFailureInput) => ({
  status: "block" as const,
  reason: input.reason,
  browserMode: "unsupported" as const,
  profileStatus: "profile_unavailable" as const,
  profileVerificationStatus: "default_unverified" as const,
});

const buildOpenDispatchFailureNavigationDecision = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
) => ({
  status: "failed" as const,
  reason: input.reason,
  browserActionId: null,
  openedUrl: null,
  pageTitleAfter: null,
  navigationAttemptRef: derived.navigationAttemptRef,
  navigationCallId: derived.navigationAttemptRef,
  redirectChain: derived.redirectChain,
  timeoutDecision: "within_limit" as const,
  abortDecision: "not_requested" as const,
  circuitBreakerState: "closed" as const,
  browserOpenStillRunningGuard: false,
  alreadyOnTargetFreshnessDecision: "not_applicable" as const,
});

const buildOpenDispatchFailurePostOpenDecision = (input: OpenDispatchFailureInput) => ({
  status: input.status,
  classification: "unknown" as const,
  reason: input.reason,
  openedUrl: null,
  pageTitleAfter: null,
  pageStateHandoffRequired: false,
  pageStateHandoffRef: null,
  authoritative: false,
  documentReadyState: null,
});

const buildOpenDispatchFailureRuntimeProofCoreFields = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
) => ({
  proofId: `open-proof:dispatch:${input.startedMonotonicMs}`,
  runId: input.trace.runId.value,
  missionId: input.trace.missionId.value,
  sessionId: input.trace.sessionId.value,
  roundId: input.trace.roundId,
  videoVisitId: input.trace.videoVisitId,
  abilityGroupId: "open" as const,
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
  targetUrlSource: input.trace.targetUrl.value ? "provided" as const : "rejected_missing" as const,
  openedUrl: null,
  redirectChain: derived.redirectChain,
  browserProfileRef: null,
  browserMode: "unsupported" as const,
  profileVerificationStatus: "default_unverified" as const,
  loginStateBefore: "unknown" as const,
  loginStateAfter: "unknown" as const,
  pageTitleAfter: null,
});

const buildOpenDispatchFailureRuntimeProofDecisionFields = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
) => ({
  idempotencyKey: derived.idempotencyKey,
  idempotencyDecision: "not_started" as const,
  openAttemptRef: derived.navigationAttemptRef,
  navigationCallId: derived.navigationAttemptRef,
  navigationAttemptRef: derived.navigationAttemptRef,
  timeoutDecision: "within_limit" as const,
  abortDecision: "not_requested" as const,
  circuitBreakerState: "closed" as const,
  targetPolicyDecision: buildOpenDispatchFailureTargetPolicyDecision(input),
  urlSafetyDecision: buildOpenDispatchFailureUrlSafetyDecision(input),
  sessionDecision: buildOpenDispatchFailureSessionDecision(input),
  navigationDecision: buildOpenDispatchFailureNavigationDecision(input, derived),
  postOpenDecision: buildOpenDispatchFailurePostOpenDecision(input),
  preliminaryOpenClassification: "unknown" as const,
  pageStateHandoffRequired: false,
  pageStateHandoffRef: null,
});

const buildOpenDispatchFailureRuntimeProofTailFields = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
) => ({
  sourceRef: derived.sourceRef,
  sessionSnapshotAvailable: false,
  sessionSnapshotFailureReason: "dispatch failed before any trusted session snapshot could be recorded",
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: Math.max(0, Math.round(input.endedMonotonicMs - input.startedMonotonicMs)),
  status: input.status,
  failureReason: derived.failureReason,
  reviewRequiredReason: input.status === "review_required" ? input.reason : null,
  dataQualityFlags: derived.dataQualityFlags,
  clock: {
    portKind: "open-clock-port" as const,
    startedMonotonicMs: input.startedMonotonicMs,
    endedMonotonicMs: input.endedMonotonicMs,
  },
});

export const buildOpenDispatchFailureRuntimeProof = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
): OpenRuntimeProof =>
  OpenRuntimeProofSchema.parse({
    ...buildOpenDispatchFailureRuntimeProofCoreFields(input, derived),
    ...buildOpenDispatchFailureRuntimeProofDecisionFields(input, derived),
    ...buildOpenDispatchFailureRuntimeProofTailFields(input, derived),
  });

const buildOpenDispatchFailureResultFields = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
  runtimeProof: OpenRuntimeProof,
) => ({
  abilityGroupId: "open" as const,
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
  failureReason: derived.failureReason,
  reviewRequiredReason: input.status === "review_required" ? input.reason : null,
  runtimeProof,
});

export const buildOpenDispatchFailureResult = (
  input: OpenDispatchFailureInput,
  derived: OpenDispatchFailureDerivedState,
  runtimeProof: OpenRuntimeProof,
): OpenResult =>
  OpenResultSchema.parse(buildOpenDispatchFailureResultFields(input, derived, runtimeProof));