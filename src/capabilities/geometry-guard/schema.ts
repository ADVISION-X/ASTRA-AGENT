import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

export const GEOMETRY_GUARD_ABILITY_GROUP_ID = "geometry-guard" as const;
export const GEOMETRY_GUARD_CHILD_CAPABILITY_IDS = [
  "validate-click-grid-cell",
  "validate-bbox-grid-region",
] as const;

// ── Primitives ────────────────────────────────────────────────────────────────

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const nullableString = z.string().nullable().optional().default(null);

// ── Geometry primitive types ──────────────────────────────────────────────────

export const GeometryGuardPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

export const GeometryGuardBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

export const GeometryGuardSizeSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

export const GeometryGuardChildCapabilityIdSchema = z.enum(
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
);

export const GeometryGuardSafetyPolicySchema = z.object({
  minDistanceFromViewportEdge: z
    .number()
    .finite()
    .nonnegative()
    .optional()
    .default(4),
  maxBboxAreaRatio: z.number().min(0).max(1).optional().default(1),
  allowOffscreen: z.literal(false).optional().default(false),
  allowZeroSize: z.literal(false).optional().default(false),
});

// ── Input ─────────────────────────────────────────────────────────────────────

const GeometryGuardBaseInputSchema = z.object({
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1).optional().default("unknown"),
  roundId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  inputRef: nullableString,
  sourceRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  sourceAiResultRef: nullableString,
  sourcePageStateProofRef: nullableString,
  sourceGeometryHandoffRef: nullableString,
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  gridSpecRef: nullableString,
  sourceCoordinateSpace: z.string().min(1).optional().default("grid"),
  requestedExecutionSpace: z.string().min(1).optional().default("browserViewport"),
  bbox: GeometryGuardBoundingBoxSchema.nullable().optional().default(null),
  clickPoint: GeometryGuardPointSchema.nullable().optional().default(null),
  imageSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  viewportSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  screenSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  deviceScaleFactor: z
    .number()
    .finite()
    .positive()
    .nullable()
    .optional()
    .default(null),
  safetyPolicy: GeometryGuardSafetyPolicySchema.optional().default({}),
  idempotencyKey: nullableString,
});

export const ValidateClickGridCellInputSchema =
  GeometryGuardBaseInputSchema.extend({
    childCapabilityId: z.literal("validate-click-grid-cell"),
  });

export const ValidateBboxGridRegionInputSchema =
  GeometryGuardBaseInputSchema.extend({
    childCapabilityId: z.literal("validate-bbox-grid-region"),
  });

export const GeometryGuardAbilityInputSchema = z.discriminatedUnion(
  "childCapabilityId",
  [ValidateClickGridCellInputSchema, ValidateBboxGridRegionInputSchema],
);

// ── Proof ─────────────────────────────────────────────────────────────────────

export const GeometryGuardRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1).optional().default("unknown"),
  roundId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  inputRef: nullableString,
  sourceRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  gridSpecRef: nullableString,
  sourceCoordinateSpace: z.string().min(1),
  requestedExecutionSpace: z.string().min(1),
  normalizedCoordinateSpace: z
    .literal("browserViewport")
    .nullable()
    .default(null),
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  guardDecision: z.enum(["allow", "deny", "review_required"]),
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

// ── Output (stored as result.output) ─────────────────────────────────────────

export const GeometryGuardOutputSchema = z.object({
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  geometryGuardRef: z.string().min(1),
  outputRef: z.string().min(1),
  guardDecision: z.enum(["allow", "deny", "review_required"]),
  normalizedCoordinateSpace: z
    .literal("browserViewport")
    .nullable()
    .default(null),
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  sourceAiResultRef: nullableString,
  sourcePageStateProofRef: nullableString,
});

// ── Result ────────────────────────────────────────────────────────────────────

export const GeometryGuardAbilityResultSchema = z.object({
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  status: z.enum(["success", "failed", "review_required"]),
  geometryGuardRef: z.string().min(1),
  guardDecision: z.enum(["allow", "deny", "review_required"]),
  normalizedCoordinateSpace: z
    .literal("browserViewport")
    .nullable()
    .default(null),
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  failureReason: z.string().nullable().default(null),
  reviewRequiredReason: z.string().nullable().default(null),
  statusMessage: z.string().min(1),
  output: GeometryGuardOutputSchema.nullable().default(null),
  runtimeProof: GeometryGuardRuntimeProofSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});
