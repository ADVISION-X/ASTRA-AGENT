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
import { MOUSE_SCROLL_VERIFICATION_REF_POLICY } from "../shared/mouse-scroll-proof.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";

export function buildMouseScrollRuntimeProof(input: {
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  sourceAbilityGroupId: string;
  sourceChildCapabilityId: string | null;
  geometryGuardRef: string | null;
  geometryGuardProofRef: string | null;
  inputRef: string;
  outputRef: string;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  regionRef: string | null;
  coordinateSpace: MouseScrollCoordinateSpace;
  anchorPoint: MouseScrollAnchor | null;
  region: MouseScrollRegion | null;
  bounds: MouseScrollBounds | null;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  requestedDelta: MouseScrollDelta | null;
  executableDelta: MouseScrollDelta | null;
  repeat: number;
  idempotencyKey: string;
  primitiveExecutionRefs: string[];
  postScrollVerificationRequired: boolean;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_skipped";
  geometryDecision: "allow" | "block" | "review_required";
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw";
  dataQualityFlags: string[];
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
}) {
  return MouseScrollRuntimeProofSchema.parse({
    proofId: buildStableMouseScrollRef("mouse-scroll-proof", [input.idempotencyKey, input.status]),
    runId: buildStableMouseScrollRef("mouse-scroll-run", [input.sessionId, input.childCapabilityId, input.roundId, input.videoVisitId]),
    missionId: input.sessionId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    abilityGroupId: "mouse-scroll",
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    geometryGuardRef: input.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProofRef,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    sourceEvidenceRef: input.sourceEvidenceRef,
    sourceTargetRef: input.sourceTargetRef,
    regionRef: input.regionRef,
    coordinateSpace: input.coordinateSpace,
    anchorPoint: input.status === "success" ? input.anchorPoint : null,
    region: input.region,
    bounds: input.bounds,
    direction: input.direction,
    magnitude: input.magnitude,
    requestedDelta: input.requestedDelta,
    executableDelta: input.status === "success" ? input.executableDelta : null,
    repeat: input.repeat,
    idempotencyKey: input.idempotencyKey,
    primitiveExecutionRefs: input.primitiveExecutionRefs,
    postScrollVerificationRequired: input.postScrollVerificationRequired,
    verificationRefPolicy: MOUSE_SCROLL_VERIFICATION_REF_POLICY,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    policyDecision: input.policyDecision,
    geometryDecision: input.geometryDecision,
    primitiveDecision: input.primitiveDecision,
    dataQualityFlags: input.dataQualityFlags,
    clock: {
      portKind: "system-monotonic-clock",
      startedMonotonicMs: input.clock.startedMonotonicMs,
      endedMonotonicMs: input.clock.endedMonotonicMs,
    },
  });
}