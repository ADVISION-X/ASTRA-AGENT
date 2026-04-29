import type { MouseScrollFailureReason } from "../contract.js";
import type { MouseScrollExecutionSeed } from "./mouse-scroll-input-gate.js";
import { MouseScrollResultSchema } from "../schema.js";
import { MOUSE_SCROLL_VERIFICATION_REF_POLICY } from "../shared/mouse-scroll-proof.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import { buildMouseScrollRuntimeProof } from "./mouse-scroll-proof-builder.js";

export function buildMouseScrollResult(input: {
  seed: MouseScrollExecutionSeed;
  idempotencyKey: string;
  scrollExecutionRef: string;
  status: "success" | "failed" | "review_required";
  failureReason: MouseScrollFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  requestedDelta: { deltaX: number; deltaY: number } | null;
  executableDelta: { deltaX: number; deltaY: number } | null;
  requestedAnchor: { x: number; y: number } | null;
  executableAnchor: { x: number; y: number } | null;
  primitiveExecutionRefs: string[];
  policyDecision: "allow" | "block" | "review_required" | "duplicate_skipped";
  geometryDecision: "allow" | "block" | "review_required";
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
}) {
  const outputRef = buildStableMouseScrollRef("mouse-scroll-output", [input.scrollExecutionRef, input.status]);
  const postScrollVerificationRequired = input.status === "success";
  const runtimeProof = buildMouseScrollRuntimeProof({
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
    sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    inputRef: buildStableMouseScrollRef("mouse-scroll-input", [input.idempotencyKey]),
    outputRef,
    sourceEvidenceRef: input.seed.sourceEvidenceRef,
    sourceTargetRef: input.seed.sourceTargetRef,
    regionRef: input.seed.regionRef,
    coordinateSpace: input.seed.coordinateSpace,
    anchorPoint: input.status === "success" ? input.executableAnchor : null,
    region: input.seed.region,
    bounds: input.seed.bounds,
    direction: input.seed.direction,
    magnitude: input.seed.magnitude,
    requestedDelta: input.requestedDelta,
    executableDelta: input.status === "success" ? input.executableDelta : null,
    repeat: input.seed.repeat,
    idempotencyKey: input.idempotencyKey,
    primitiveExecutionRefs: input.primitiveExecutionRefs,
    postScrollVerificationRequired,
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
    clock: input.clock,
  });

  return MouseScrollResultSchema.parse({
    status: input.status,
    abilityGroupId: "mouse-scroll",
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    scrollExecutionRef: input.scrollExecutionRef,
    primitiveExecutionRefs: input.primitiveExecutionRefs,
    geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
    requestedDelta: input.requestedDelta,
    executableDelta: input.status === "success" ? input.executableDelta : null,
    executableAnchor: input.status === "success" ? input.executableAnchor : null,
    coordinateSpace: input.seed.coordinateSpace,
    regionRef: input.seed.regionRef,
    direction: input.seed.direction,
    magnitude: input.seed.magnitude,
    repeat: input.seed.repeat,
    postScrollVerificationRequired,
    verificationRefPolicy: MOUSE_SCROLL_VERIFICATION_REF_POLICY,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    debugLogRef: null,
    runtimeProof,
  });
}