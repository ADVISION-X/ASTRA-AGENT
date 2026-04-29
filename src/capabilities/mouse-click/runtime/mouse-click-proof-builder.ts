import type { MouseClickButton, MouseClickChildCapabilityId, MouseClickCoordinateSpace, MouseClickCount } from "../contract.js";
import { MouseClickRuntimeProofSchema } from "../schema.js";
import { MOUSE_CLICK_VERIFICATION_REF_POLICY } from "../shared/mouse-click-proof.js";
import { buildStableMouseClickRef } from "../shared/mouse-click-types.js";

export function buildMouseClickRuntimeProof(input: {
  childCapabilityId: MouseClickChildCapabilityId;
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
  sourceCoordinateProofRef: string | null;
  coordinateSpace: MouseClickCoordinateSpace;
  requestedCoordinate: { x: number; y: number } | null;
  executableCoordinate: { x: number; y: number } | null;
  bounds: { width: number; height: number } | null;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  idempotencyKey: string;
  primitiveExecutionRef: string | null;
  postActionVerificationRequired: boolean;
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
  return MouseClickRuntimeProofSchema.parse({
    proofId: buildStableMouseClickRef("mouse-click-proof", [input.idempotencyKey, input.status]),
    runId: buildStableMouseClickRef("mouse-click-run", [input.sessionId, input.childCapabilityId, input.roundId, input.videoVisitId]),
    missionId: input.sessionId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    videoVisitId: input.videoVisitId,
    abilityGroupId: "mouse-click",
    childCapabilityId: input.childCapabilityId,
    sourceAbilityGroupId: input.sourceAbilityGroupId,
    sourceChildCapabilityId: input.sourceChildCapabilityId,
    geometryGuardRef: input.geometryGuardRef,
    geometryGuardProofRef: input.geometryGuardProofRef,
    inputRef: input.inputRef,
    outputRef: input.outputRef,
    sourceEvidenceRef: input.sourceEvidenceRef,
    sourceTargetRef: input.sourceTargetRef,
    sourceCoordinateProofRef: input.sourceCoordinateProofRef,
    coordinateSpace: input.coordinateSpace,
    requestedCoordinate: input.requestedCoordinate,
    executableCoordinate: input.executableCoordinate,
    bounds: input.bounds,
    button: input.button,
    clickCount: input.clickCount,
    idempotencyKey: input.idempotencyKey,
    primitiveExecutionRef: input.primitiveExecutionRef,
    postActionVerificationRequired: input.postActionVerificationRequired,
    verificationRefPolicy: MOUSE_CLICK_VERIFICATION_REF_POLICY,
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