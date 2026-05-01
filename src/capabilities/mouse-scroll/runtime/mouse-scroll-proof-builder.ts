import type {
  MouseScrollAnchor,
  MouseScrollBounds,
  MouseScrollChildCapabilityId,
  MouseScrollCoordinateSpace,
  MouseScrollDelta,
  MouseScrollDirection,
  MouseScrollMagnitude,
  MouseScrollRegion,
} from "../contract.js";
import { MouseScrollRuntimeProofSchema } from "../schema.js";
import { MOUSE_SCROLL_PROOF } from "../shared/mouse-scroll-proof.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";

type BuildMouseScrollRuntimeProofInput = {
  attemptRef: string;
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string | null;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string | null;
  sourceChildCapabilityId: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  inputRef: string;
  outputRef: string;
  scrollExecutionRef: string | null;
  rejectionRef: string | null;
  parseErrorRef: string | null;
  receivedShapeHash: string | null;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  sourceCoordinateProofRef: string | null;
  regionRef: string | null;
  coordinateSpace: MouseScrollCoordinateSpace;
  sourceCoordinateSpace: MouseScrollCoordinateSpace | null;
  anchorPoint: MouseScrollAnchor | null;
  region: MouseScrollRegion | null;
  bounds: MouseScrollBounds | null;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  requestedDelta: MouseScrollDelta | null;
  executableDelta: MouseScrollDelta | null;
  deltaResolutionDecision: string | null;
  deltaCapDecision: string | null;
  repeat: number;
  idempotencyKey: string | null;
  idempotencyDecision: string | null;
  primitiveExecutionRefs: string[];
  primitiveCallId: string | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  primitivePortKind: string;
  perIterationPrimitiveProofs: Array<{
    repeatIndex: number;
    primitiveCallId: string;
    primitiveExecutionRef: string | null;
    status: string;
    startedAt: string;
    endedAt: string;
    durationMs: number;
    timeoutDecision: string;
    abortDecision: string;
    portHangDetected: boolean;
    primitivePortKind: string;
  }>;
  primitiveTimeoutMs: number;
  maxDurationMs: number;
  timeoutDecision: string;
  abortDecision: string;
  circuitBreakerState: string;
  postActionVerificationRequired: boolean;
  postActionVerificationHandoffRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  geometryDecisionReason: string | null;
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw" | "aborted";
  dataQualityFlags: string[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
};

const buildMouseScrollProofIdentityFields = (input: BuildMouseScrollRuntimeProofInput) => ({
  proofId: buildStableMouseScrollRef("mouse-scroll-proof", [input.attemptRef, input.status]),
  runId: buildStableMouseScrollRef("mouse-scroll-run", [input.sessionId, input.childCapabilityId, input.roundId, input.videoVisitId, input.attemptRef]),
  missionId: input.sessionId ?? input.attemptRef,
  sessionId: input.sessionId,
  roundId: input.roundId,
  videoVisitId: input.videoVisitId,
  abilityGroupId: "mouse-scroll" as const,
  childCapabilityId: input.childCapabilityId,
  inputRef: input.inputRef,
  outputRef: input.outputRef,
  attemptRef: input.attemptRef,
  scrollExecutionRef: input.scrollExecutionRef,
  rejectionRef: input.rejectionRef,
  parseErrorRef: input.parseErrorRef,
  receivedShapeHash: input.receivedShapeHash,
});

const buildMouseScrollProofGeometryFields = (input: BuildMouseScrollRuntimeProofInput) => ({
  sourceAbilityGroupId: input.sourceAbilityGroupId,
  sourceChildCapabilityId: input.sourceChildCapabilityId,
  geometryGuardRef: input.geometryGuardRef,
  geometryGuardProofRef: input.geometryGuardProofRef,
  sourceCoordinateProofRef: input.sourceCoordinateProofRef,
  sourceEvidenceRef: input.sourceEvidenceRef,
  sourceTargetRef: input.sourceTargetRef,
  regionRef: input.regionRef,
  coordinateSpace: input.coordinateSpace,
  sourceCoordinateSpace: input.sourceCoordinateSpace,
  requestedExecutionSpace: input.coordinateSpace,
  normalizedCoordinateSpace: input.coordinateSpace,
  anchorPoint: input.anchorPoint,
  region: input.region,
  bounds: input.bounds,
  direction: input.direction,
  magnitude: input.magnitude,
  requestedDelta: input.requestedDelta,
  executableDelta: input.status === "success" ? input.executableDelta : null,
  deltaResolutionDecision: input.deltaResolutionDecision,
  deltaCapDecision: input.deltaCapDecision,
  repeat: input.repeat,
  idempotencyKey: input.idempotencyKey,
  idempotencyDecision: input.idempotencyDecision,
});

const buildMouseScrollProofPrimitiveFields = (input: BuildMouseScrollRuntimeProofInput) => ({
  primitiveExecutionRefs: input.primitiveExecutionRefs,
  primitiveCallId: input.primitiveCallId,
  perIterationPrimitiveProofs: input.perIterationPrimitiveProofs,
  primitiveTimeoutMs: input.primitiveTimeoutMs,
  maxDurationMs: input.maxDurationMs,
  timeoutDecision: input.timeoutDecision,
  abortDecision: input.abortDecision,
  circuitBreakerState: input.circuitBreakerState,
  primitivePortKind: input.primitivePortKind,
  primitiveStartedAt: input.primitiveStartedAt,
  primitiveEndedAt: input.primitiveEndedAt,
  postActionVerificationRequired: input.postActionVerificationRequired,
  postActionVerificationHandoffRef: input.postActionVerificationHandoffRef,
  verificationRefPolicy: MOUSE_SCROLL_PROOF.VERIFICATION_REF_POLICY,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  clock: {
    portKind: "system-monotonic-clock",
    startedMonotonicMs: input.clock.startedMonotonicMs,
    endedMonotonicMs: input.clock.endedMonotonicMs,
  },
});

const buildMouseScrollProofDecisionFields = (input: BuildMouseScrollRuntimeProofInput) => ({
  status: input.status,
  failureReason: input.failureReason,
  reviewRequiredReason: input.reviewRequiredReason,
  policyDecision: input.policyDecision,
  policyDecisionReason: input.policyDecisionReason,
  geometryDecision: input.geometryDecision,
  geometryDecisionReason: input.geometryDecisionReason,
  safetyDecision: input.safetyDecision,
  safetyDecisionReason: input.safetyDecisionReason,
  primitiveDecision: input.primitiveDecision,
  dataQualityFlags: input.dataQualityFlags,
});

export function buildMouseScrollRuntimeProof(input: BuildMouseScrollRuntimeProofInput) {
  return MouseScrollRuntimeProofSchema.parse({
    ...buildMouseScrollProofIdentityFields(input),
    ...buildMouseScrollProofGeometryFields(input),
    ...buildMouseScrollProofPrimitiveFields(input),
    ...buildMouseScrollProofDecisionFields(input),
  });
}