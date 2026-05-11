import { z } from "zod";

import { MOUSE_CLICK_FAILURE_REASONS } from "./shared/mouse-click-failure.js";
import { DEFAULT_MOUSE_CLICK_SAFETY_POLICY } from "./shared/mouse-click-policy.js";
import { MOUSE_CLICK_PROOF } from "./shared/mouse-click-proof.js";
import { MOUSE_CLICK_PRE_ACTION_DECISIONS, MOUSE_CLICK_STATUSES } from "./shared/mouse-click-result.js";
import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_BUTTONS,
  MOUSE_CLICK_CHILD_CAPABILITY_IDS,
  MOUSE_CLICK_COORDINATE_SPACES,
  MOUSE_CLICK_COUNTS,
} from "./shared/mouse-click-types.js";
import { validateMouseClickAbilityResult, validateMouseClickInputBindings, validateMouseClickRuntimeProof } from "./mouse-click-schema-refinements.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const nullableString = z.string().min(1).nullable().optional().default(null);
const nullableSessionId = z.string().min(1).nullable().optional().default(null);
const {
  ABORT_DECISIONS: MOUSE_CLICK_ABORT_DECISIONS,
  CIRCUIT_BREAKER_STATES: MOUSE_CLICK_CIRCUIT_BREAKER_STATES,
  CLOCK_KIND: MOUSE_CLICK_CLOCK_KIND,
  GEOMETRY_DECISIONS: MOUSE_CLICK_GEOMETRY_DECISIONS,
  IDEMPOTENCY_DECISIONS: MOUSE_CLICK_IDEMPOTENCY_DECISIONS,
  POLICY_DECISIONS: MOUSE_CLICK_POLICY_DECISIONS,
  PRIMITIVE_DECISIONS: MOUSE_CLICK_PRIMITIVE_DECISIONS,
  SAFETY_DECISIONS: MOUSE_CLICK_SAFETY_DECISIONS,
  TIMEOUT_DECISIONS: MOUSE_CLICK_TIMEOUT_DECISIONS,
  VERIFICATION_REF_POLICY: MOUSE_CLICK_VERIFICATION_REF_POLICY,
} = MOUSE_CLICK_PROOF;

const MouseClickChildCapabilityIdSchema = z.enum(MOUSE_CLICK_CHILD_CAPABILITY_IDS);
const MouseClickCoordinateSpaceSchema = z.enum(MOUSE_CLICK_COORDINATE_SPACES);
const MouseClickButtonSchema = z.enum(MOUSE_CLICK_BUTTONS);
const MouseClickCountSchema = z.union([z.literal(MOUSE_CLICK_COUNTS[0]), z.literal(MOUSE_CLICK_COUNTS[1])]);
const MouseClickFailureReasonSchema = z.enum(MOUSE_CLICK_FAILURE_REASONS);
const MouseClickStatusSchema = z.enum(MOUSE_CLICK_STATUSES);
const MouseClickGeometryDecisionSchema = z.enum(MOUSE_CLICK_GEOMETRY_DECISIONS);
const MouseClickPolicyDecisionSchema = z.enum(MOUSE_CLICK_POLICY_DECISIONS);
const MouseClickSafetyDecisionSchema = z.enum(MOUSE_CLICK_SAFETY_DECISIONS);
const MouseClickPrimitiveDecisionSchema = z.enum(MOUSE_CLICK_PRIMITIVE_DECISIONS);
const MouseClickIdempotencyDecisionSchema = z.enum(MOUSE_CLICK_IDEMPOTENCY_DECISIONS);
const MouseClickTimeoutDecisionSchema = z.enum(MOUSE_CLICK_TIMEOUT_DECISIONS);
const MouseClickAbortDecisionSchema = z.enum(MOUSE_CLICK_ABORT_DECISIONS);
const MouseClickCircuitBreakerStateSchema = z.enum(MOUSE_CLICK_CIRCUIT_BREAKER_STATES);
const MouseClickPreActionDecisionSchema = z.enum(MOUSE_CLICK_PRE_ACTION_DECISIONS);

const MouseClickPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

const MouseClickBoundsSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
}).strict();

const MouseClickSafetyPolicySchema = z.object({
  allowOperatorManual: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowOperatorManual),
  operatorManualApprovalRef: nullableString,
  allowRightClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowRightClick),
  allowDoubleClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowDoubleClick),
  allowReplay: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowReplay),
  allowDesktopScreenClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowDesktopScreenClick),
  desktopScreenOperatorApprovalRef: nullableString,
  currentPhaseAllowsDesktopClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.currentPhaseAllowsDesktopClick),
  platformProfileAllowsDesktopClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.platformProfileAllowsDesktopClick),
  desktopOperatorApprovalValidUntil: nullableString,
  maxDurationMs: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.maxDurationMs),
  primitiveTimeoutMs: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.primitiveTimeoutMs),
  cooldownMs: nonNegativeInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.cooldownMs),
  idempotencyTtlMs: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.idempotencyTtlMs),
  maxIdempotencyReservations: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.maxIdempotencyReservations),
  maxScopeEntries: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.maxScopeEntries),
  requireStableRoundBinding: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.requireStableRoundBinding),
  requireStableVideoVisitBinding: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.requireStableVideoVisitBinding),
}).strict();

const MouseClickGeometryGuardProofSchema = z.object({
  proofId: z.string().min(1),
  geometryGuardRef: z.string().min(1),
  abilityGroupId: z.literal("geometry-guard"),
  childCapabilityId: z.string().min(1),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: z.string().min(1),
  bindingPackageId: z.string().min(1),
  bindingPackageVersion: z.string().min(1),
  selectedBindingId: z.string().min(1),
  bindingVersion: z.string().min(1),
  bindingSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  status: z.literal("success"),
  guardDecision: z.literal("allow"),
  normalizedCoordinateSpace: MouseClickCoordinateSpaceSchema,
  normalizedClickPoint: MouseClickPointSchema,
  sourceBounds: MouseClickBoundsSchema.nullable().optional().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: z.string().min(1),
  sourceVisualTargetResultRef: nullableString,
  riskLevel: z.enum(["low", "medium", "high"]).nullable().optional().default(null),
  requiresPostClickAiVerification: z.boolean().optional().default(false),
  dataQualityFlags: z.string().min(1).nullable().optional().default(null),
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  runtimeProofRef: z.string().min(1),
}).strict();

const MouseClickBaseInputSchema = z.object({
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID).default(MOUSE_CLICK_ABILITY_GROUP_ID),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: z.string().min(1),
  bindingPackageId: z.string().min(1),
  bindingPackageVersion: z.string().min(1),
  selectedBindingId: z.string().min(1),
  bindingVersion: z.string().min(1),
  bindingSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  inputRef: z.string().min(1),
  sourceRef: z.string().min(1),
  sourceCoordinateProofRef: z.string().min(1),
  sourceEvidenceRef: nullableString,
  sourceTargetRef: z.string().min(1),
  sourceVisualTargetResultRef: nullableString,
  geometryGuardProof: MouseClickGeometryGuardProofSchema,
  geometryGuardRef: z.string().min(1),
  guardDecision: z.literal("allow"),
  geometryGuardOutputRef: z.string().min(1),
  geometryGuardRuntimeProofRef: z.string().min(1),
  geometryGuardNormalizedCoordinateSpace: MouseClickCoordinateSpaceSchema,
  geometryGuardNormalizedClickPoint: MouseClickPointSchema,
  button: MouseClickButtonSchema.default("left"),
  clickCount: MouseClickCountSchema.default(1),
  bounds: MouseClickBoundsSchema,
  idempotencyKey: z.string().min(1),
  timeoutMs: positiveInt,
  safetyPolicy: MouseClickSafetyPolicySchema.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY),
}).strict();

const ClickBrowserCoordinateInputSchema = MouseClickBaseInputSchema.extend({
  childCapabilityId: z.literal("click-browser-coordinate"),
  geometryGuardProof: MouseClickGeometryGuardProofSchema.extend({
    normalizedCoordinateSpace: z.literal("browserViewport"),
  }),
  geometryGuardNormalizedCoordinateSpace: z.literal("browserViewport"),
}).strict();

const ClickDesktopCoordinateInputSchema = MouseClickBaseInputSchema.extend({
  childCapabilityId: z.literal("click-desktop-coordinate"),
  geometryGuardProof: MouseClickGeometryGuardProofSchema.extend({
    normalizedCoordinateSpace: z.literal("desktopScreen"),
  }),
  geometryGuardNormalizedCoordinateSpace: z.literal("desktopScreen"),
}).strict();

export const MOUSE_CLICK_SCHEMA_VALIDATION_MARKERS = [
  "mouse click success is primitive execution proof only",
  "retryCount must stay 0 for every Mouse Click attempt",
  "maxRetry must stay 0 for every Mouse Click attempt",
  "failed and review_required require output=null",
] as const;

const MouseClickAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ClickBrowserCoordinateInputSchema,
  ClickDesktopCoordinateInputSchema,
]).superRefine(validateMouseClickInputBindings);

const MouseClickClockSchema = z.object({
  portKind: z.literal(MOUSE_CLICK_CLOCK_KIND),
  startedMonotonicMs: finiteNumber,
  endedMonotonicMs: finiteNumber,
}).strict();

const MouseClickRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: nullableString,
  missionId: nullableString,
  sessionId: nullableSessionId,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  bindingPackageId: nullableString,
  bindingPackageVersion: nullableString,
  selectedBindingId: nullableString,
  bindingVersion: nullableString,
  bindingSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
  childCapabilityId: MouseClickChildCapabilityIdSchema,
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  sourceRef: nullableString,
  outputRef: z.string().min(1),
  diagnosticPayloadRef: nullableString,
  attemptRef: z.string().min(1),
  actionExecutionRef: nullableString,
  rejectionRef: nullableString,
  parseErrorRef: nullableString,
  receivedShapeHash: nullableString,
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  geometryGuardOutputRef: nullableString,
  geometryGuardRuntimeProofRef: nullableString,
  sourceCoordinateProofRef: nullableString,
  sourceTargetRef: nullableString,
  sourceEvidenceRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  coordinateSpace: MouseClickCoordinateSpaceSchema,
  sourceCoordinateSpace: MouseClickCoordinateSpaceSchema.nullable().default(null),
  requestedExecutionSpace: MouseClickCoordinateSpaceSchema,
  normalizedCoordinateSpace: MouseClickCoordinateSpaceSchema.nullable().default(null),
  requestedCoordinate: MouseClickPointSchema.nullable().default(null),
  executableCoordinate: MouseClickPointSchema.nullable().default(null),
  bounds: MouseClickBoundsSchema.nullable().default(null),
  sourceBounds: MouseClickBoundsSchema.nullable().default(null),
  targetBounds: MouseClickBoundsSchema.nullable().default(null),
  coordinateRoundingDecision: nullableString,
  scaleDecision: nullableString,
  transformDecision: nullableString,
  button: MouseClickButtonSchema,
  clickCount: MouseClickCountSchema,
  preActionDecision: MouseClickPreActionDecisionSchema,
  policyDecision: MouseClickPolicyDecisionSchema,
  policyDecisionReason: nullableString,
  geometryDecision: MouseClickGeometryDecisionSchema,
  safetyDecision: MouseClickSafetyDecisionSchema,
  safetyDecisionReason: nullableString,
  idempotencyKey: nullableString,
  idempotencyDecision: MouseClickIdempotencyDecisionSchema.nullable().default(null),
  runLockId: nullableString,
  cancellationTokenRef: nullableString,
  resumeCheckpointRef: nullableString,
  primitiveDecision: MouseClickPrimitiveDecisionSchema,
  primitiveCallId: nullableString,
  primitiveExecutionRef: nullableString,
  timeoutMs: nonNegativeInt.nullable().default(null),
  primitiveTimeoutMs: nonNegativeInt,
  maxDurationMs: nonNegativeInt,
  retryCount: nonNegativeInt.default(0),
  maxRetry: nonNegativeInt.default(0),
  timeoutDecision: MouseClickTimeoutDecisionSchema,
  abortDecision: MouseClickAbortDecisionSchema,
  circuitBreakerState: MouseClickCircuitBreakerStateSchema,
  clickSuppressedReason: nullableString,
  primitivePortKind: z.string().min(1),
  primitiveStartedAt: nullableString,
  primitiveEndedAt: nullableString,
  postClickObservation: z.boolean(),
  postClickObservationRef: nullableString,
  postActionVerificationRequired: z.boolean().default(false),
  postActionVerificationHandoffRef: nullableString,
  verificationRefPolicy: z.literal(MOUSE_CLICK_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: MouseClickStatusSchema,
  failureReason: MouseClickFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clock: MouseClickClockSchema,
}).strict().superRefine(validateMouseClickRuntimeProof);

const MouseClickSuccessOutputSchema = z.object({
  clickResultRef: z.string().min(1),
  attemptRef: z.string().min(1),
  actionExecutionRef: z.string().min(1),
  primitiveExecutionRef: z.string().min(1),
  geometryGuardRef: z.string().min(1),
  geometryGuardProofRef: z.string().min(1),
  sourceCoordinateProofRef: z.string().min(1),
  sourceTargetRef: z.string().min(1),
  sourceVisualTargetResultRef: nullableString,
  normalizedClickPoint: MouseClickPointSchema,
  coordinateSpace: MouseClickCoordinateSpaceSchema,
  button: MouseClickButtonSchema,
  clickCount: MouseClickCountSchema,
  postClickObservation: z.boolean(),
  postClickObservationRef: nullableString,
  postActionVerificationRequired: z.literal(true),
  postActionVerificationHandoffRef: z.string().min(1),
}).strict();

const MouseClickBaseResultSchema = z.object({
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
  childCapabilityId: MouseClickChildCapabilityIdSchema,
  status: MouseClickStatusSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: nullableSessionId,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  bindingPackageId: nullableString,
  bindingPackageVersion: nullableString,
  selectedBindingId: nullableString,
  bindingVersion: nullableString,
  bindingSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  clickResultRef: nullableString,
  attemptRef: z.string().min(1),
  diagnosticPayloadRef: nullableString,
  output: MouseClickSuccessOutputSchema.nullable().default(null),
  failureReason: MouseClickFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  geometryGuardRef: nullableString,
  policyDecision: MouseClickPolicyDecisionSchema,
  geometryGuardProofRef: nullableString,
  sourceCoordinateProofRef: nullableString,
  sourceTargetRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  geometryDecision: MouseClickGeometryDecisionSchema,
  safetyDecision: MouseClickSafetyDecisionSchema,
  primitiveDecision: MouseClickPrimitiveDecisionSchema,
  timeoutDecision: MouseClickTimeoutDecisionSchema,
  abortDecision: MouseClickAbortDecisionSchema,
  idempotencyDecision: MouseClickIdempotencyDecisionSchema.nullable().default(null),
  postClickObservationRef: nullableString,
  postActionVerificationRequired: z.boolean().default(false),
  postActionVerificationHandoffRef: nullableString,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  runtimeProof: MouseClickRuntimeProofSchema,
}).strict();

const ClickBrowserCoordinateResultSchema = MouseClickBaseResultSchema.extend({
  childCapabilityId: z.literal("click-browser-coordinate"),
}).strict();

const ClickDesktopCoordinateResultSchema = MouseClickBaseResultSchema.extend({
  childCapabilityId: z.literal("click-desktop-coordinate"),
}).strict();

const MouseClickAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ClickBrowserCoordinateResultSchema,
  ClickDesktopCoordinateResultSchema,
]).superRefine(validateMouseClickAbilityResult);

export {
  ClickBrowserCoordinateInputSchema,
  ClickBrowserCoordinateResultSchema,
  ClickDesktopCoordinateInputSchema,
  ClickDesktopCoordinateResultSchema,
  MouseClickAbilityInputSchema,
  MouseClickAbilityResultSchema,
  MouseClickAbortDecisionSchema,
  MouseClickBoundsSchema,
  MouseClickButtonSchema,
  MouseClickChildCapabilityIdSchema,
  MouseClickCircuitBreakerStateSchema,
  MouseClickClockSchema,
  MouseClickCoordinateSpaceSchema,
  MouseClickCountSchema,
  MouseClickFailureReasonSchema,
  MouseClickGeometryDecisionSchema,
  MouseClickGeometryGuardProofSchema,
  MouseClickIdempotencyDecisionSchema,
  MouseClickPointSchema,
  MouseClickPolicyDecisionSchema,
  MouseClickPreActionDecisionSchema,
  MouseClickPrimitiveDecisionSchema,
  MouseClickRuntimeProofSchema,
  MouseClickSafetyDecisionSchema,
  MouseClickSafetyPolicySchema,
  MouseClickStatusSchema,
  MouseClickSuccessOutputSchema,
  MouseClickTimeoutDecisionSchema,
};
