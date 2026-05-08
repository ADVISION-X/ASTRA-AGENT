import { z } from "zod";

import { MOUSE_SCROLL_FAILURE_REASONS } from "./shared/mouse-scroll-failure.js";
import { DEFAULT_MOUSE_SCROLL_SAFETY_POLICY } from "./shared/mouse-scroll-policy.js";
import { MOUSE_SCROLL_PROOF } from "./shared/mouse-scroll-proof.js";
import { MOUSE_SCROLL_STATUSES } from "./shared/mouse-scroll-result.js";
import {
  MOUSE_SCROLL_ABILITY_GROUP_ID,
  MOUSE_SCROLL_CHILD_CAPABILITY_IDS,
  MOUSE_SCROLL_COORDINATE_SPACES,
  MOUSE_SCROLL_DIRECTIONS,
  MOUSE_SCROLL_MAGNITUDES,
} from "./shared/mouse-scroll-types.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const nullableString = z.string().min(1).nullable().default(null);
const nullableSessionId = z.string().min(1).nullable().default(null);
const {
  ABORT_DECISIONS: MOUSE_SCROLL_ABORT_DECISIONS,
  CIRCUIT_BREAKER_STATES: MOUSE_SCROLL_CIRCUIT_BREAKER_STATES,
  CLOCK_KIND: MOUSE_SCROLL_CLOCK_KIND,
  GEOMETRY_DECISIONS: MOUSE_SCROLL_GEOMETRY_DECISIONS,
  IDEMPOTENCY_DECISIONS: MOUSE_SCROLL_IDEMPOTENCY_DECISIONS,
  POLICY_DECISIONS: MOUSE_SCROLL_POLICY_DECISIONS,
  PRIMITIVE_DECISIONS: MOUSE_SCROLL_PRIMITIVE_DECISIONS,
  SAFETY_DECISIONS: MOUSE_SCROLL_SAFETY_DECISIONS,
  TIMEOUT_DECISIONS: MOUSE_SCROLL_TIMEOUT_DECISIONS,
  VERIFICATION_REF_POLICY: MOUSE_SCROLL_VERIFICATION_REF_POLICY,
} = MOUSE_SCROLL_PROOF;

const MouseScrollChildCapabilityIdSchema = z.enum(MOUSE_SCROLL_CHILD_CAPABILITY_IDS);
const MouseScrollCoordinateSpaceSchema = z.enum(MOUSE_SCROLL_COORDINATE_SPACES);
const MouseScrollDirectionSchema = z.enum(MOUSE_SCROLL_DIRECTIONS);
const MouseScrollMagnitudeSchema = z.enum(MOUSE_SCROLL_MAGNITUDES);
const MouseScrollFailureReasonSchema = z.enum(MOUSE_SCROLL_FAILURE_REASONS);
const MouseScrollStatusSchema = z.enum(MOUSE_SCROLL_STATUSES);
const MouseScrollPolicyDecisionSchema = z.enum(MOUSE_SCROLL_POLICY_DECISIONS);
const MouseScrollGeometryDecisionSchema = z.enum(MOUSE_SCROLL_GEOMETRY_DECISIONS);
const MouseScrollSafetyDecisionSchema = z.enum(MOUSE_SCROLL_SAFETY_DECISIONS);
const MouseScrollPrimitiveDecisionSchema = z.enum(MOUSE_SCROLL_PRIMITIVE_DECISIONS);
const MouseScrollIdempotencyDecisionSchema = z.enum(MOUSE_SCROLL_IDEMPOTENCY_DECISIONS);
const MouseScrollTimeoutDecisionSchema = z.enum(MOUSE_SCROLL_TIMEOUT_DECISIONS);
const MouseScrollAbortDecisionSchema = z.enum(MOUSE_SCROLL_ABORT_DECISIONS);
const MouseScrollCircuitBreakerStateSchema = z.enum(MOUSE_SCROLL_CIRCUIT_BREAKER_STATES);

const MouseScrollAnchorSchema = z.object({ x: finiteNumber, y: finiteNumber }).strict();
const MouseScrollDeltaSchema = z.object({ deltaX: finiteNumber, deltaY: finiteNumber }).strict();
const MouseScrollBoundsSchema = z.object({ width: positiveFiniteNumber, height: positiveFiniteNumber }).strict();
const MouseScrollRegionSchema = z.object({ x: finiteNumber, y: finiteNumber, width: positiveFiniteNumber, height: positiveFiniteNumber }).strict();

const MouseScrollSafetyPolicySchema = z.object({
  allowOperatorManual: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowOperatorManual),
  operatorManualApprovalRef: nullableString,
  allowReplay: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowReplay),
  allowDesktopScreenScroll: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowDesktopScreenScroll),
  desktopScreenOperatorApprovalRef: nullableString,
  currentPhaseAllowsDesktopScroll: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.currentPhaseAllowsDesktopScroll),
  platformProfileAllowsDesktopScroll: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.platformProfileAllowsDesktopScroll),
  desktopOperatorApprovalValidUntil: nullableString,
  maxRepeat: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxRepeat),
  maxDeltaAbs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxDeltaAbs),
  maxDurationMs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxDurationMs),
  primitiveTimeoutMs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.primitiveTimeoutMs),
  cooldownMs: nonNegativeInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.cooldownMs),
  idempotencyTtlMs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.idempotencyTtlMs),
  maxIdempotencyReservations: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxIdempotencyReservations),
  maxScopeEntries: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxScopeEntries),
  requireStableRoundBinding: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.requireStableRoundBinding),
  requireStableVideoVisitBinding: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.requireStableVideoVisitBinding),
}).strict();

const GeometryScrollProofRefSchema = z.string().min(1);

const MouseScrollGeometryScrollProofSchema = z.object({
  proofId: GeometryScrollProofRefSchema,
  geometryGuardRef: z.string().min(1),
  abilityGroupId: z.literal("geometry-guard"),
  childCapabilityId: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  status: z.literal("success"),
  guardDecision: z.literal("allow"),
  normalizedCoordinateSpace: MouseScrollCoordinateSpaceSchema,
  normalizedAnchorPoint: MouseScrollAnchorSchema,
  normalizedRegion: MouseScrollRegionSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  inputRef: nullableString,
  outputRef: nullableString,
}).strict();

const MouseScrollBaseInputSchema = z.object({
  abilityGroupId: z.literal(MOUSE_SCROLL_ABILITY_GROUP_ID).default(MOUSE_SCROLL_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  sourceCoordinateProofRef: GeometryScrollProofRefSchema,
  sourceEvidenceRef: nullableString,
  sourceTargetRef: z.string().min(1),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema,
  coordinateSpace: MouseScrollCoordinateSpaceSchema,
  bounds: MouseScrollBoundsSchema,
  region: MouseScrollRegionSchema.nullable().default(null),
  regionRef: nullableString,
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  customDelta: MouseScrollDeltaSchema.nullable().default(null),
  repeat: positiveInt.default(1),
  safetyPolicy: MouseScrollSafetyPolicySchema.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY),
}).strict();

const ScrollBrowserViewportInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-browser-viewport"),
  coordinateSpace: z.literal("browserViewport"),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedCoordinateSpace: z.literal("browserViewport"),
  }),
  region: z.null().default(null),
  regionRef: z.null().default(null),
}).strict();

const ScrollDesktopScreenInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-desktop-screen"),
  coordinateSpace: z.literal("desktopScreen"),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedCoordinateSpace: z.literal("desktopScreen"),
  }),
  region: z.null().default(null),
  regionRef: z.null().default(null),
}).strict();

const ScrollRegionInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-region"),
  region: MouseScrollRegionSchema,
  regionRef: z.string().min(1),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedRegion: MouseScrollRegionSchema,
  }),
}).strict();

const MouseScrollAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ScrollBrowserViewportInputSchema,
  ScrollDesktopScreenInputSchema,
  ScrollRegionInputSchema,
]);

const MouseScrollClockSchema = z.object({
  portKind: z.literal(MOUSE_SCROLL_CLOCK_KIND),
  startedMonotonicMs: finiteNumber,
  endedMonotonicMs: finiteNumber,
}).strict();

const MouseScrollPerIterationPrimitiveProofSchema = z.object({
  repeatIndex: positiveInt,
  primitiveCallId: z.string().min(1),
  primitiveExecutionRef: nullableString,
  status: z.enum(["succeeded", "failed", "threw", "aborted"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  timeoutDecision: MouseScrollTimeoutDecisionSchema,
  abortDecision: MouseScrollAbortDecisionSchema,
  portHangDetected: z.boolean(),
  primitivePortKind: z.string().min(1),
}).strict();

const MouseScrollRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: nullableSessionId,
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(MOUSE_SCROLL_ABILITY_GROUP_ID),
  childCapabilityId: MouseScrollChildCapabilityIdSchema,
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  attemptRef: z.string().min(1),
  scrollExecutionRef: nullableString,
  rejectionRef: nullableString,
  parseErrorRef: nullableString,
  receivedShapeHash: nullableString,
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  sourceCoordinateProofRef: nullableString,
  sourceTargetRef: nullableString,
  sourceEvidenceRef: nullableString,
  regionRef: nullableString,
  coordinateSpace: MouseScrollCoordinateSpaceSchema,
  sourceCoordinateSpace: MouseScrollCoordinateSpaceSchema.nullable().default(null),
  requestedExecutionSpace: MouseScrollCoordinateSpaceSchema,
  normalizedCoordinateSpace: MouseScrollCoordinateSpaceSchema,
  anchorPoint: MouseScrollAnchorSchema.nullable().default(null),
  region: MouseScrollRegionSchema.nullable().default(null),
  bounds: MouseScrollBoundsSchema.nullable().default(null),
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  requestedDelta: MouseScrollDeltaSchema.nullable().default(null),
  executableDelta: MouseScrollDeltaSchema.nullable().default(null),
  deltaResolutionDecision: nullableString,
  deltaCapDecision: nullableString,
  repeat: positiveInt,
  idempotencyKey: nullableString,
  idempotencyDecision: MouseScrollIdempotencyDecisionSchema.nullable().default(null),
  runLockId: nullableString,
  cancellationTokenRef: nullableString,
  resumeCheckpointRef: nullableString,
  primitiveExecutionRefs: z.array(z.string().min(1)).default([]),
  primitiveCallId: nullableString,
  perIterationPrimitiveProofs: z.array(MouseScrollPerIterationPrimitiveProofSchema).default([]),
  timeoutMs: nonNegativeInt.nullable().default(null),
  primitiveTimeoutMs: nonNegativeInt,
  maxDurationMs: nonNegativeInt,
  retryCount: nonNegativeInt.default(0),
  maxRetry: nonNegativeInt.default(0),
  timeoutDecision: MouseScrollTimeoutDecisionSchema,
  abortDecision: MouseScrollAbortDecisionSchema,
  circuitBreakerState: MouseScrollCircuitBreakerStateSchema,
  primitivePortKind: z.string().min(1),
  primitiveStartedAt: z.string().datetime().nullable().default(null),
  primitiveEndedAt: z.string().datetime().nullable().default(null),
  postClickObservation: z.boolean(),
  postClickObservationRef: nullableString,
  verificationRefPolicy: z.literal(MOUSE_SCROLL_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: MouseScrollStatusSchema,
  failureReason: MouseScrollFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  policyDecision: MouseScrollPolicyDecisionSchema,
  policyDecisionReason: nullableString,
  geometryDecision: MouseScrollGeometryDecisionSchema,
  geometryDecisionReason: nullableString,
  safetyDecision: MouseScrollSafetyDecisionSchema,
  safetyDecisionReason: nullableString,
  primitiveDecision: MouseScrollPrimitiveDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clock: MouseScrollClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.scrollExecutionRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires scrollExecutionRef", path: ["scrollExecutionRef"] });
    }
    if (value.executableDelta === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires executableDelta", path: ["executableDelta"] });
    }
    if (value.primitiveExecutionRefs.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires primitiveExecutionRefs", path: ["primitiveExecutionRefs"] });
    }
  }
});

const MouseScrollSuccessOutputSchema = z.object({
  scrollExecutionRef: z.string().min(1),
  primitiveExecutionRefs: z.array(z.string().min(1)).min(1),
  coordinateSpace: MouseScrollCoordinateSpaceSchema,
  executableAnchor: MouseScrollAnchorSchema,
  executableDelta: MouseScrollDeltaSchema,
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  repeat: positiveInt,
  postClickObservation: z.boolean(),
  postClickObservationRef: nullableString,
}).strict();

const MouseScrollBaseResultSchema = z.object({
  status: MouseScrollStatusSchema,
  abilityGroupId: z.literal(MOUSE_SCROLL_ABILITY_GROUP_ID),
  sessionId: nullableSessionId,
  roundId: nullableString,
  videoVisitId: nullableString,
  attemptRef: z.string().min(1),
  output: MouseScrollSuccessOutputSchema.nullable().default(null),
  failureReason: MouseScrollFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  policyDecision: MouseScrollPolicyDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  runtimeProof: MouseScrollRuntimeProofSchema,
}).strict();

const ScrollBrowserViewportResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-browser-viewport"),
}).strict();

const ScrollDesktopScreenResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-desktop-screen"),
}).strict();

const ScrollRegionResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-region"),
}).strict();

const MouseScrollAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ScrollBrowserViewportResultSchema,
  ScrollDesktopScreenResultSchema,
  ScrollRegionResultSchema,
]).superRefine((value, context) => {
  if (value.status === "success" && value.output === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires output", path: ["output"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed and review_required require output=null", path: ["output"] });
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.runtimeProof.attemptRef !== value.attemptRef) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.attemptRef must equal result.attemptRef", path: ["runtimeProof", "attemptRef"] });
  }
});

const MouseScrollResultSchema = MouseScrollAbilityResultSchema;

export {
  GeometryScrollProofRefSchema,
  MouseScrollAbilityInputSchema,
  MouseScrollAbilityResultSchema,
  MouseScrollAbortDecisionSchema,
  MouseScrollAnchorSchema,
  MouseScrollBoundsSchema,
  MouseScrollChildCapabilityIdSchema,
  MouseScrollCircuitBreakerStateSchema,
  MouseScrollClockSchema,
  MouseScrollCoordinateSpaceSchema,
  MouseScrollDeltaSchema,
  MouseScrollDirectionSchema,
  MouseScrollFailureReasonSchema,
  MouseScrollGeometryDecisionSchema,
  MouseScrollGeometryScrollProofSchema,
  MouseScrollIdempotencyDecisionSchema,
  MouseScrollMagnitudeSchema,
  MouseScrollPerIterationPrimitiveProofSchema,
  MouseScrollPolicyDecisionSchema,
  MouseScrollPrimitiveDecisionSchema,
  MouseScrollRegionSchema,
  MouseScrollResultSchema,
  MouseScrollRuntimeProofSchema,
  MouseScrollSafetyDecisionSchema,
  MouseScrollSafetyPolicySchema,
  MouseScrollStatusSchema,
  MouseScrollSuccessOutputSchema,
  MouseScrollTimeoutDecisionSchema,
  ScrollBrowserViewportInputSchema,
  ScrollBrowserViewportResultSchema,
  ScrollDesktopScreenInputSchema,
  ScrollDesktopScreenResultSchema,
  ScrollRegionInputSchema,
  ScrollRegionResultSchema,
};
