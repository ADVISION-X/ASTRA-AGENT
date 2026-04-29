import type { MouseClickExecutionSeed } from "./mouse-click-input-gate.js";
import { MouseClickAbilityResultSchema } from "../schema.js";
import { MOUSE_CLICK_VERIFICATION_REF_POLICY } from "../shared/mouse-click-proof.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";
import { buildMouseClickRuntimeProof } from "./mouse-click-proof-builder.js";

export function buildMouseClickResult(input: {
  seed: MouseClickExecutionSeed;
  idempotencyKey: string;
  actionExecutionRef: string;
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  requestedCoordinate: { x: number; y: number } | null;
  executableCoordinate: { x: number; y: number } | null;
  primitiveExecutionRef: string | null;
  policyDecision: "allow" | "block" | "review_required" | "duplicate_skipped";
  geometryDecision: "allow" | "block" | "review_required";
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  dataQualityFlags: string[];
}) {
  const outputRef = buildStableMouseClickRef("mouse-click-output", [input.actionExecutionRef, input.status]);
  const postActionVerificationRequired = input.status === "success";
  const runtimeProof = buildMouseClickRuntimeProof({
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
    sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
    geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    inputRef: buildStableMouseClickRef("mouse-click-input", [input.idempotencyKey]),
    outputRef,
    sourceEvidenceRef: input.seed.sourceEvidenceRef,
    sourceTargetRef: input.seed.sourceTargetRef,
    sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
    coordinateSpace: input.seed.coordinateSpace,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: input.status === "success" ? input.executableCoordinate : null,
    bounds: input.seed.bounds,
    button: input.seed.button,
    clickCount: input.seed.clickCount,
    idempotencyKey: input.idempotencyKey,
    primitiveExecutionRef: input.primitiveExecutionRef,
    postActionVerificationRequired,
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

  return MouseClickAbilityResultSchema.parse({
    status: input.status,
    abilityGroupId: "mouse-click",
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    actionExecutionRef: input.actionExecutionRef,
    primitiveExecutionRef: input.primitiveExecutionRef,
    geometryGuardRef: input.seed.geometryGuardRef,
    geometryGuardProofRef: input.seed.geometryGuardProofRef,
    sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
    normalizedClickPoint: input.status === "success" ? input.executableCoordinate : null,
    coordinateSpace: input.seed.coordinateSpace,
    button: input.seed.button,
    clickCount: input.seed.clickCount,
    postActionVerificationRequired,
    verificationRefPolicy: MOUSE_CLICK_VERIFICATION_REF_POLICY,
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