import { z } from "zod";

import { MOUSE_SCROLL_FAILURE_REASONS } from "./shared/mouse-scroll-failure.js";
import { DEFAULT_MOUSE_SCROLL_SAFETY_POLICY } from "./shared/mouse-scroll-policy.js";
import {
  MOUSE_SCROLL_CLOCK_KIND,
  MOUSE_SCROLL_GEOMETRY_DECISIONS,
  MOUSE_SCROLL_POLICY_DECISIONS,
  MOUSE_SCROLL_PRIMITIVE_DECISIONS,
  MOUSE_SCROLL_VERIFICATION_REF_POLICY,
} from "./shared/mouse-scroll-proof.js";
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
const nullableString = z.string().min(1).nullable().optional().default(null);

export const MouseScrollChildCapabilityIdSchema = z.enum(MOUSE_SCROLL_CHILD_CAPABILITY_IDS);
export const MouseScrollCoordinateSpaceSchema = z.enum(MOUSE_SCROLL_COORDINATE_SPACES);
export const MouseScrollDirectionSchema = z.enum(MOUSE_SCROLL_DIRECTIONS);
export const MouseScrollMagnitudeSchema = z.enum(MOUSE_SCROLL_MAGNITUDES);
export const MouseScrollFailureReasonSchema = z.enum(MOUSE_SCROLL_FAILURE_REASONS);
export const MouseScrollStatusSchema = z.enum(MOUSE_SCROLL_STATUSES);
export const MouseScrollPolicyDecisionSchema = z.enum(MOUSE_SCROLL_POLICY_DECISIONS);
export const MouseScrollGeometryDecisionSchema = z.enum(MOUSE_SCROLL_GEOMETRY_DECISIONS);
export const MouseScrollPrimitiveDecisionSchema = z.enum(MOUSE_SCROLL_PRIMITIVE_DECISIONS);

export const MouseScrollAnchorSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

export const MouseScrollDeltaSchema = z.object({
  deltaX: finiteNumber,
  deltaY: finiteNumber,
}).strict();

export const MouseScrollBoundsSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
}).strict();

export const MouseScrollRegionSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
}).strict();

export const MouseScrollSafetyPolicySchema = z.object({
  allowOperatorManual: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowOperatorManual),
  operatorManualApprovalRef: nullableString,
  allowReplay: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowReplay),
  allowDesktopScreenScroll: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.allowDesktopScreenScroll),
  desktopScreenOperatorApprovalRef: nullableString,
  maxRepeat: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxRepeat),
  maxDeltaAbs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxDeltaAbs),
  maxDurationMs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.maxDurationMs),
  primitiveTimeoutMs: positiveInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.primitiveTimeoutMs),
  cooldownMs: nonNegativeInt.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.cooldownMs),
  requireStableRoundBinding: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.requireStableRoundBinding),
  requireStableVideoVisitBinding: z.boolean().default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY.requireStableVideoVisitBinding),
}).strict();

export const GeometryScrollProofRefSchema = z.string().min(1);

export const MouseScrollGeometryScrollProofSchema = z.object({
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
  normalizedRegion: MouseScrollRegionSchema.nullable().optional().default(null),
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
  region: MouseScrollRegionSchema.nullable().optional().default(null),
  regionRef: nullableString,
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  customDelta: MouseScrollDeltaSchema.nullable().optional().default(null),
  repeat: positiveInt.default(1),
  safetyPolicy: MouseScrollSafetyPolicySchema.default(DEFAULT_MOUSE_SCROLL_SAFETY_POLICY),
}).strict();

export const ScrollBrowserViewportInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-browser-viewport"),
  coordinateSpace: z.literal("browserViewport"),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedCoordinateSpace: z.literal("browserViewport"),
  }),
  region: z.null().optional().default(null),
  regionRef: z.null().optional().default(null),
}).strict();

export const ScrollDesktopScreenInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-desktop-screen"),
  coordinateSpace: z.literal("desktopScreen"),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedCoordinateSpace: z.literal("desktopScreen"),
  }),
  region: z.null().optional().default(null),
  regionRef: z.null().optional().default(null),
}).strict();

export const ScrollRegionInputSchema = MouseScrollBaseInputSchema.extend({
  childCapabilityId: z.literal("scroll-region"),
  region: MouseScrollRegionSchema,
  regionRef: z.string().min(1),
  geometryScrollProof: MouseScrollGeometryScrollProofSchema.extend({
    normalizedRegion: MouseScrollRegionSchema,
  }),
}).strict();

export const MouseScrollAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ScrollBrowserViewportInputSchema,
  ScrollDesktopScreenInputSchema,
  ScrollRegionInputSchema,
]);

export const MouseScrollClockSchema = z.object({
  portKind: z.literal(MOUSE_SCROLL_CLOCK_KIND),
  startedMonotonicMs: finiteNumber,
  endedMonotonicMs: finiteNumber,
}).strict();

export const MouseScrollRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(MOUSE_SCROLL_ABILITY_GROUP_ID),
  childCapabilityId: MouseScrollChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  sourceEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  regionRef: nullableString,
  coordinateSpace: MouseScrollCoordinateSpaceSchema,
  anchorPoint: MouseScrollAnchorSchema.nullable().default(null),
  region: MouseScrollRegionSchema.nullable().default(null),
  bounds: MouseScrollBoundsSchema.nullable().default(null),
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  requestedDelta: MouseScrollDeltaSchema.nullable().default(null),
  executableDelta: MouseScrollDeltaSchema.nullable().default(null),
  repeat: positiveInt,
  idempotencyKey: z.string().min(1),
  primitiveExecutionRefs: z.array(z.string().min(1)),
  postScrollVerificationRequired: z.boolean(),
  verificationRefPolicy: z.literal(MOUSE_SCROLL_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: MouseScrollStatusSchema,
  failureReason: MouseScrollFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  policyDecision: MouseScrollPolicyDecisionSchema,
  geometryDecision: MouseScrollGeometryDecisionSchema,
  primitiveDecision: MouseScrollPrimitiveDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clock: MouseScrollClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.anchorPoint === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires anchorPoint", path: ["anchorPoint"] });
    }
    if (value.executableDelta === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires executableDelta", path: ["executableDelta"] });
    }
    if (value.primitiveExecutionRefs.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires primitiveExecutionRefs", path: ["primitiveExecutionRefs"] });
    }
    if (!value.postScrollVerificationRequired) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires postScrollVerificationRequired=true", path: ["postScrollVerificationRequired"] });
    }
  }
  if (value.status !== "success") {
    if (value.anchorPoint !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required proof must not expose anchorPoint", path: ["anchorPoint"] });
    }
    if (value.executableDelta !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required proof must not expose executableDelta", path: ["executableDelta"] });
    }
  }
});

const MouseScrollBaseResultSchema = z.object({
  status: MouseScrollStatusSchema,
  abilityGroupId: z.literal(MOUSE_SCROLL_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  scrollExecutionRef: z.string().min(1),
  primitiveExecutionRefs: z.array(z.string().min(1)),
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  sourceCoordinateProofRef: GeometryScrollProofRefSchema,
  requestedDelta: MouseScrollDeltaSchema.nullable().default(null),
  executableDelta: MouseScrollDeltaSchema.nullable().default(null),
  executableAnchor: MouseScrollAnchorSchema.nullable().default(null),
  coordinateSpace: MouseScrollCoordinateSpaceSchema,
  regionRef: nullableString,
  direction: MouseScrollDirectionSchema,
  magnitude: MouseScrollMagnitudeSchema,
  repeat: positiveInt,
  postScrollVerificationRequired: z.boolean(),
  verificationRefPolicy: z.literal(MOUSE_SCROLL_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  failureReason: MouseScrollFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  debugLogRef: nullableString,
  runtimeProof: MouseScrollRuntimeProofSchema,
}).strict();

export const ScrollBrowserViewportResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-browser-viewport"),
  coordinateSpace: z.literal("browserViewport"),
}).strict();

export const ScrollDesktopScreenResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-desktop-screen"),
  coordinateSpace: z.literal("desktopScreen"),
}).strict();

export const ScrollRegionResultSchema = MouseScrollBaseResultSchema.extend({
  childCapabilityId: z.literal("scroll-region"),
}).strict();

export const MouseScrollAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ScrollBrowserViewportResultSchema,
  ScrollDesktopScreenResultSchema,
  ScrollRegionResultSchema,
]).superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.executableDelta === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires executableDelta", path: ["executableDelta"] });
    }
    if (value.executableAnchor === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires executableAnchor", path: ["executableAnchor"] });
    }
    if (value.primitiveExecutionRefs.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires primitiveExecutionRefs", path: ["primitiveExecutionRefs"] });
    }
    if (!value.postScrollVerificationRequired) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires postScrollVerificationRequired=true", path: ["postScrollVerificationRequired"] });
    }
  }
  if (value.status !== "success") {
    if (value.executableDelta !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required must not expose executableDelta", path: ["executableDelta"] });
    }
    if (value.executableAnchor !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required must not expose executableAnchor", path: ["executableAnchor"] });
    }
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
});

export const MouseScrollResultSchema = MouseScrollAbilityResultSchema;