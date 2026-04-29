import { z } from "zod";

import { MOUSE_CLICK_FAILURE_REASONS } from "./shared/mouse-click-failure.js";
import { DEFAULT_MOUSE_CLICK_SAFETY_POLICY } from "./shared/mouse-click-policy.js";
import {
  MOUSE_CLICK_CLOCK_KIND,
  MOUSE_CLICK_GEOMETRY_DECISIONS,
  MOUSE_CLICK_POLICY_DECISIONS,
  MOUSE_CLICK_PRIMITIVE_DECISIONS,
  MOUSE_CLICK_VERIFICATION_REF_POLICY,
} from "./shared/mouse-click-proof.js";
import { MOUSE_CLICK_STATUSES } from "./shared/mouse-click-result.js";
import {
  MOUSE_CLICK_ABILITY_GROUP_ID,
  MOUSE_CLICK_BUTTONS,
  MOUSE_CLICK_CHILD_CAPABILITY_IDS,
  MOUSE_CLICK_COORDINATE_SPACES,
  MOUSE_CLICK_COUNTS,
} from "./shared/mouse-click-types.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const nullableString = z.string().min(1).nullable().optional().default(null);

export const MouseClickChildCapabilityIdSchema = z.enum(MOUSE_CLICK_CHILD_CAPABILITY_IDS);
export const MouseClickCoordinateSpaceSchema = z.enum(MOUSE_CLICK_COORDINATE_SPACES);
export const MouseClickButtonSchema = z.enum(MOUSE_CLICK_BUTTONS);
export const MouseClickCountSchema = z.union([z.literal(MOUSE_CLICK_COUNTS[0]), z.literal(MOUSE_CLICK_COUNTS[1])]);
export const MouseClickFailureReasonSchema = z.enum(MOUSE_CLICK_FAILURE_REASONS);
export const MouseClickStatusSchema = z.enum(MOUSE_CLICK_STATUSES);
export const MouseClickGeometryDecisionSchema = z.enum(MOUSE_CLICK_GEOMETRY_DECISIONS);
export const MouseClickPolicyDecisionSchema = z.enum(MOUSE_CLICK_POLICY_DECISIONS);
export const MouseClickPrimitiveDecisionSchema = z.enum(MOUSE_CLICK_PRIMITIVE_DECISIONS);

export const MouseClickPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
}).strict();

export const MouseClickBoundsSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
}).strict();

export const MouseClickSafetyPolicySchema = z.object({
  allowOperatorManual: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowOperatorManual),
  operatorManualApprovalRef: nullableString,
  allowRightClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowRightClick),
  allowDoubleClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowDoubleClick),
  allowReplay: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowReplay),
  allowDesktopScreenClick: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.allowDesktopScreenClick),
  desktopScreenOperatorApprovalRef: nullableString,
  maxDurationMs: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.maxDurationMs),
  primitiveTimeoutMs: positiveInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.primitiveTimeoutMs),
  cooldownMs: nonNegativeInt.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.cooldownMs),
  requireStableRoundBinding: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.requireStableRoundBinding),
  requireStableVideoVisitBinding: z.boolean().default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY.requireStableVideoVisitBinding),
}).strict();

export const MouseClickGeometryGuardProofSchema = z.object({
  proofId: z.string().min(1),
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
  normalizedCoordinateSpace: MouseClickCoordinateSpaceSchema,
  normalizedClickPoint: MouseClickPointSchema,
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  inputRef: nullableString,
  outputRef: nullableString,
}).strict();

const MouseClickBaseInputSchema = z.object({
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID).default(MOUSE_CLICK_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  sourceCoordinateProofRef: z.string().min(1),
  sourceEvidenceRef: nullableString,
  sourceTargetRef: z.string().min(1),
  geometryGuardProof: MouseClickGeometryGuardProofSchema,
  button: MouseClickButtonSchema.default("left"),
  clickCount: MouseClickCountSchema.default(1),
  bounds: MouseClickBoundsSchema,
  safetyPolicy: MouseClickSafetyPolicySchema.default(DEFAULT_MOUSE_CLICK_SAFETY_POLICY),
}).strict();

export const ClickBrowserCoordinateInputSchema = MouseClickBaseInputSchema.extend({
  childCapabilityId: z.literal("click-browser-coordinate"),
  geometryGuardProof: MouseClickGeometryGuardProofSchema.extend({
    normalizedCoordinateSpace: z.literal("browserViewport"),
  }),
}).strict();

export const ClickDesktopCoordinateInputSchema = MouseClickBaseInputSchema.extend({
  childCapabilityId: z.literal("click-desktop-coordinate"),
  geometryGuardProof: MouseClickGeometryGuardProofSchema.extend({
    normalizedCoordinateSpace: z.literal("desktopScreen"),
  }),
}).strict();

export const MouseClickAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ClickBrowserCoordinateInputSchema,
  ClickDesktopCoordinateInputSchema,
]);

export const MouseClickClockSchema = z.object({
  portKind: z.literal(MOUSE_CLICK_CLOCK_KIND),
  startedMonotonicMs: finiteNumber,
  endedMonotonicMs: finiteNumber,
}).strict();

export const MouseClickRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
  childCapabilityId: MouseClickChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  sourceEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceCoordinateProofRef: nullableString,
  coordinateSpace: MouseClickCoordinateSpaceSchema,
  requestedCoordinate: MouseClickPointSchema.nullable().default(null),
  executableCoordinate: MouseClickPointSchema.nullable().default(null),
  bounds: MouseClickBoundsSchema.nullable().default(null),
  button: MouseClickButtonSchema,
  clickCount: MouseClickCountSchema,
  idempotencyKey: z.string().min(1),
  primitiveExecutionRef: nullableString,
  postActionVerificationRequired: z.boolean(),
  verificationRefPolicy: z.literal(MOUSE_CLICK_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: MouseClickStatusSchema,
  failureReason: MouseClickFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  policyDecision: MouseClickPolicyDecisionSchema,
  geometryDecision: MouseClickGeometryDecisionSchema,
  primitiveDecision: MouseClickPrimitiveDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  clock: MouseClickClockSchema,
}).strict().superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.primitiveExecutionRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires primitiveExecutionRef", path: ["primitiveExecutionRef"] });
    }
    if (value.executableCoordinate === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires executableCoordinate", path: ["executableCoordinate"] });
    }
    if (!value.postActionVerificationRequired) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires postActionVerificationRequired=true", path: ["postActionVerificationRequired"] });
    }
  }
  if (value.status !== "success" && value.executableCoordinate !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required proof must not expose executableCoordinate", path: ["executableCoordinate"] });
  }
});

const MouseClickBaseResultSchema = z.object({
  status: MouseClickStatusSchema,
  abilityGroupId: z.literal(MOUSE_CLICK_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  actionExecutionRef: z.string().min(1),
  primitiveExecutionRef: nullableString,
  geometryGuardRef: nullableString,
  geometryGuardProofRef: nullableString,
  sourceCoordinateProofRef: nullableString,
  normalizedClickPoint: MouseClickPointSchema.nullable().default(null),
  button: MouseClickButtonSchema,
  clickCount: MouseClickCountSchema,
  postActionVerificationRequired: z.boolean(),
  verificationRefPolicy: z.literal(MOUSE_CLICK_VERIFICATION_REF_POLICY),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  failureReason: MouseClickFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  statusMessage: z.string().min(1),
  debugLogRef: nullableString,
  runtimeProof: MouseClickRuntimeProofSchema,
}).strict();

export const ClickBrowserCoordinateResultSchema = MouseClickBaseResultSchema.extend({
  childCapabilityId: z.literal("click-browser-coordinate"),
  coordinateSpace: z.literal("browserViewport"),
}).strict();

export const ClickDesktopCoordinateResultSchema = MouseClickBaseResultSchema.extend({
  childCapabilityId: z.literal("click-desktop-coordinate"),
  coordinateSpace: z.literal("desktopScreen"),
}).strict();

export const MouseClickAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ClickBrowserCoordinateResultSchema,
  ClickDesktopCoordinateResultSchema,
]).superRefine((value, context) => {
  if (value.startedAt > value.endedAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedAt must not be after endedAt", path: ["startedAt"] });
  }
  if (value.status === "success") {
    if (value.primitiveExecutionRef === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires primitiveExecutionRef", path: ["primitiveExecutionRef"] });
    }
    if (value.normalizedClickPoint === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires normalizedClickPoint", path: ["normalizedClickPoint"] });
    }
    if (!value.postActionVerificationRequired) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "success requires postActionVerificationRequired=true", path: ["postActionVerificationRequired"] });
    }
  }
  if (value.status !== "success" && value.normalizedClickPoint !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required must not expose normalizedClickPoint", path: ["normalizedClickPoint"] });
  }
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
});