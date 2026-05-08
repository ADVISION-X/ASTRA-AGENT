import type { MouseScrollFailureReason } from "../contract.js";
import type { MouseScrollResultSeed } from "./mouse-scroll-input-gate.js";
import { MouseScrollAbilityResultSchema } from "../schema.js";
import { buildStableMouseScrollRef } from "../shared/mouse-scroll-types.js";
import { buildMouseScrollRuntimeProof } from "./mouse-scroll-proof-builder.js";

type BuildMouseScrollResultInput = {
  seed: MouseScrollResultSeed;
  idempotencyKey: string | null;
  scrollExecutionRef: string | null;
  rejectionRef: string | null;
  status: "success" | "failed" | "review_required";
  failureReason: MouseScrollFailureReason | null;
  reviewRequiredReason: string | null;
  statusMessage: string;
  requestedDelta: { deltaX: number; deltaY: number } | null;
  executableDelta: { deltaX: number; deltaY: number } | null;
  requestedAnchor: { x: number; y: number } | null;
  executableAnchor: { x: number; y: number } | null;
  primitiveExecutionRefs: string[];
  policyDecision: "allow" | "block" | "review_required" | "duplicate_review_required";
  policyDecisionReason: string | null;
  geometryDecision: "allow" | "block";
  geometryDecisionReason: string | null;
  safetyDecision: "allow" | "block";
  safetyDecisionReason: string | null;
  primitiveDecision: "not_run" | "succeeded" | "failed" | "threw" | "aborted";
  deltaResolutionDecision: string | null;
  deltaCapDecision: string | null;
  idempotencyDecision: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  clock: { startedMonotonicMs: number; endedMonotonicMs: number };
  primitiveCallId: string | null;
  primitiveStartedAt: string | null;
  primitiveEndedAt: string | null;
  primitivePortKind: string;
  timeoutDecision: string;
  abortDecision: string;
  circuitBreakerState: string;
  portHangDetected: boolean;
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
  dataQualityFlags: string[];
};

const buildPostClickObservationRef = (input: BuildMouseScrollResultInput) => {
  return input.status === "success" && input.scrollExecutionRef !== null
    ? buildStableMouseScrollRef("mouse-scroll-post-action-handoff", [input.scrollExecutionRef])
    : null;
};

const buildMouseScrollOutput = (
  input: BuildMouseScrollResultInput,
  postClickObservationRef: string | null,
) => {
  return input.status === "success" && input.scrollExecutionRef !== null && input.executableAnchor !== null && input.executableDelta !== null
    ? {
        scrollExecutionRef: input.scrollExecutionRef,
        primitiveExecutionRefs: input.primitiveExecutionRefs,
        coordinateSpace: input.seed.coordinateSpace,
        executableAnchor: input.executableAnchor,
        executableDelta: input.executableDelta,
        direction: input.seed.direction,
        magnitude: input.seed.magnitude,
        repeat: input.seed.repeat,
        postClickObservation: true as const,
        postClickObservationRef,
      }
    : null;
};

const buildMouseScrollRuntimeProofSourceFields = (input: BuildMouseScrollResultInput, outputRef: string) => ({
  attemptRef: input.seed.attemptRef,
  childCapabilityId: input.seed.childCapabilityId,
  sessionId: input.seed.sessionId,
  roundId: input.seed.roundId,
  videoVisitId: input.seed.videoVisitId,
  sourceAbilityGroupId: input.seed.sourceAbilityGroupId,
  sourceChildCapabilityId: input.seed.sourceChildCapabilityId,
  geometryGuardRef: input.seed.geometryGuardRef,
  geometryGuardProofRef: input.seed.geometryGuardProofRef,
  inputRef: input.seed.inputRef,
  outputRef,
  scrollExecutionRef: input.scrollExecutionRef,
  rejectionRef: input.rejectionRef,
  parseErrorRef: input.seed.parseErrorRef,
  receivedShapeHash: input.seed.receivedShapeHash,
  sourceEvidenceRef: input.seed.sourceEvidenceRef,
  sourceTargetRef: input.seed.sourceTargetRef,
  sourceCoordinateProofRef: input.seed.sourceCoordinateProofRef,
  regionRef: input.seed.regionRef,
  coordinateSpace: input.seed.coordinateSpace,
  sourceCoordinateSpace: input.seed.sourceCoordinateSpace,
  anchorPoint: input.requestedAnchor,
  region: input.seed.region,
  bounds: input.seed.bounds,
  direction: input.seed.direction,
  magnitude: input.seed.magnitude,
  requestedDelta: input.requestedDelta,
  executableDelta: input.status === "success" ? input.executableDelta : null,
  deltaResolutionDecision: input.deltaResolutionDecision,
  deltaCapDecision: input.deltaCapDecision,
  repeat: input.seed.repeat,
  idempotencyKey: input.idempotencyKey,
  idempotencyDecision: input.idempotencyDecision,
});

const buildMouseScrollRuntimeProofPrimitiveFields = (
  input: BuildMouseScrollResultInput,
  postClickObservationRef: string | null,
) => ({
  primitiveExecutionRefs: input.primitiveExecutionRefs,
  primitiveCallId: input.primitiveCallId,
  primitiveStartedAt: input.primitiveStartedAt,
  primitiveEndedAt: input.primitiveEndedAt,
  primitivePortKind: input.primitivePortKind,
  perIterationPrimitiveProofs: input.perIterationPrimitiveProofs,
  primitiveTimeoutMs: input.primitiveTimeoutMs,
  maxDurationMs: input.maxDurationMs,
  timeoutDecision: input.timeoutDecision,
  abortDecision: input.abortDecision,
  circuitBreakerState: input.circuitBreakerState,
  postClickObservation: input.status === "success",
  postClickObservationRef,
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  clock: input.clock,
});

const buildMouseScrollRuntimeProofDecisionFields = (input: BuildMouseScrollResultInput) => ({
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

const buildMouseScrollRuntimeProofForResult = (
  input: BuildMouseScrollResultInput,
  outputRef: string,
  postClickObservationRef: string | null,
) => {
  return buildMouseScrollRuntimeProof({
    ...buildMouseScrollRuntimeProofSourceFields(input, outputRef),
    ...buildMouseScrollRuntimeProofPrimitiveFields(input, postClickObservationRef),
    ...buildMouseScrollRuntimeProofDecisionFields(input),
  });
};

const parseMouseScrollResult = (
  input: BuildMouseScrollResultInput,
  output: ReturnType<typeof buildMouseScrollOutput>,
  runtimeProof: ReturnType<typeof buildMouseScrollRuntimeProofForResult>,
) => {
  return MouseScrollAbilityResultSchema.parse({
    status: input.status,
    abilityGroupId: "mouse-scroll",
    childCapabilityId: input.seed.childCapabilityId,
    sessionId: input.seed.sessionId,
    roundId: input.seed.roundId,
    videoVisitId: input.seed.videoVisitId,
    attemptRef: input.seed.attemptRef,
    output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    statusMessage: input.statusMessage,
    policyDecision: input.policyDecision,
    dataQualityFlags: input.dataQualityFlags,
    runtimeProof,
  });
};

export function buildMouseScrollResult(input: BuildMouseScrollResultInput) {
  const outputRef = buildStableMouseScrollRef("mouse-scroll-output", [input.seed.attemptRef, input.status]);
  const postClickObservationRef = buildPostClickObservationRef(input);
  const output = buildMouseScrollOutput(input, postClickObservationRef);
  const runtimeProof = buildMouseScrollRuntimeProofForResult(input, outputRef, postClickObservationRef);

  return parseMouseScrollResult(input, output, runtimeProof);
}