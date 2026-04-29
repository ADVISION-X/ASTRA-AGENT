import { z } from "zod";

import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  GEOMETRY_GUARD_CHECK_DECISIONS,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
  GEOMETRY_GUARD_COORDINATE_SPACES,
  GEOMETRY_GUARD_DECISIONS,
  GEOMETRY_GUARD_EXECUTION_SPACES,
  GEOMETRY_GUARD_FAILURE_REASONS,
  GEOMETRY_GUARD_RESULT_STATUSES,
  GEOMETRY_GUARD_ROUNDING_POLICIES,
} from "./shared/geometry-types.js";

const finiteNumber = z.number().finite();
const positiveFiniteNumber = z.number().finite().positive();
const nullableString = z.string().min(1).nullable().optional().default(null);

export const GeometryGuardChildCapabilityIdSchema = z.enum(GEOMETRY_GUARD_CHILD_CAPABILITY_IDS);
export const GeometryGuardCoordinateSpaceSchema = z.enum(GEOMETRY_GUARD_COORDINATE_SPACES);
export const GeometryGuardExecutionSpaceSchema = z.enum(GEOMETRY_GUARD_EXECUTION_SPACES);
export const GeometryGuardStatusSchema = z.enum(GEOMETRY_GUARD_RESULT_STATUSES);
export const GeometryGuardDecisionSchema = z.enum(GEOMETRY_GUARD_DECISIONS);
export const GeometryGuardCheckDecisionSchema = z.enum(GEOMETRY_GUARD_CHECK_DECISIONS);
export const GeometryGuardFailureReasonSchema = z.enum(GEOMETRY_GUARD_FAILURE_REASONS);
export const GeometryGuardRoundingPolicySchema = z.enum(GEOMETRY_GUARD_ROUNDING_POLICIES);

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

export const GeometryGuardScaleMappingSchema = z.object({
  sourceCoordinateSpace: GeometryGuardCoordinateSpaceSchema.exclude(["browserViewport", "desktopScreen", "contactSheet"]),
  targetCoordinateSpace: GeometryGuardExecutionSpaceSchema,
  scaleMappingRef: nullableString,
  sourceWidth: positiveFiniteNumber.nullable().optional().default(null),
  sourceHeight: positiveFiniteNumber.nullable().optional().default(null),
  targetWidth: positiveFiniteNumber.nullable().optional().default(null),
  targetHeight: positiveFiniteNumber.nullable().optional().default(null),
  cropOffsetX: finiteNumber,
  cropOffsetY: finiteNumber,
  scaleX: positiveFiniteNumber,
  scaleY: positiveFiniteNumber,
});

export const GeometryGuardSafetyPolicySchema = z.object({
  allowReviewRequired: z.boolean().default(false),
  minimumConfidence: z.number().min(0).max(1).nullable().optional().default(null),
  coordinateConfidence: z.number().min(0).max(1).nullable().optional().default(null),
  requireSourceRef: z.boolean().default(true),
  clickSafetyMarginPx: z.number().finite().nonnegative().default(4),
  roundingPolicy: GeometryGuardRoundingPolicySchema.default("nearest_pixel"),
});

const GeometryGuardBaseInputSchema = z.object({
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID).default(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  inputRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceAiResultRef: nullableString,
  sourceCoordinateSpace: GeometryGuardCoordinateSpaceSchema,
  requestedExecutionSpace: GeometryGuardExecutionSpaceSchema,
  bbox: GeometryGuardBoundingBoxSchema.nullable().optional().default(null),
  clickPoint: GeometryGuardPointSchema.nullable().optional().default(null),
  imageSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  viewportSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  screenSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  deviceScaleFactor: positiveFiniteNumber.nullable().optional().default(null),
  scaleMapping: GeometryGuardScaleMappingSchema.nullable().optional().default(null),
  safetyPolicy: GeometryGuardSafetyPolicySchema.default({
    allowReviewRequired: false,
    minimumConfidence: null,
    coordinateConfidence: null,
    requireSourceRef: true,
    clickSafetyMarginPx: 4,
    roundingPolicy: "nearest_pixel",
  }),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

const createChildInputSchema = (childCapabilityId: typeof GEOMETRY_GUARD_CHILD_CAPABILITY_IDS[number]) =>
  GeometryGuardBaseInputSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });

export const ValidateCoordinateSpaceInputSchema = createChildInputSchema("validate-coordinate-space");
export const ValidateBBoxIntegrityInputSchema = createChildInputSchema("validate-bbox-integrity");
export const ValidateClickPointInputSchema = createChildInputSchema("validate-click-point");
export const ValidateScaleMappingInputSchema = createChildInputSchema("validate-scale-mapping");
export const MapAiInputToViewportInputSchema = createChildInputSchema("map-ai-input-to-viewport");
export const MapRegionToSourceInputSchema = createChildInputSchema("map-region-to-source");
export const ValidateBrowserViewportBoundsInputSchema = createChildInputSchema("validate-browser-viewport-bounds");
export const ValidateDesktopScreenBoundsInputSchema = createChildInputSchema("validate-desktop-screen-bounds");

export const GeometryGuardAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ValidateCoordinateSpaceInputSchema,
  ValidateBBoxIntegrityInputSchema,
  ValidateClickPointInputSchema,
  ValidateScaleMappingInputSchema,
  MapAiInputToViewportInputSchema,
  MapRegionToSourceInputSchema,
  ValidateBrowserViewportBoundsInputSchema,
  ValidateDesktopScreenBoundsInputSchema,
]);

export const ValidateCoordinateSpaceOutputSchema = z.object({
  kind: z.literal("validate-coordinate-space"),
  coordinateSpaceAccepted: z.literal(true),
});

export const ValidateBBoxIntegrityOutputSchema = z.object({
  kind: z.literal("validate-bbox-integrity"),
  bboxAccepted: z.literal(true),
  sourceBounds: GeometryGuardBoundingBoxSchema,
});

export const ValidateClickPointOutputSchema = z.object({
  kind: z.literal("validate-click-point"),
  clickPointAccepted: z.literal(true),
  clickSafetyMarginPx: z.number().finite().nonnegative(),
});

export const ValidateScaleMappingOutputSchema = z.object({
  kind: z.literal("validate-scale-mapping"),
  scaleMappingAccepted: z.literal(true),
  sourceBounds: GeometryGuardBoundingBoxSchema,
  targetBounds: GeometryGuardBoundingBoxSchema,
  appliedScaleMapping: GeometryGuardScaleMappingSchema,
});

const ExecutableGeometryOutputSchema = z.object({
  normalizedCoordinateSpace: GeometryGuardExecutionSpaceSchema,
  normalizedClickPoint: GeometryGuardPointSchema,
  normalizedBbox: GeometryGuardBoundingBoxSchema,
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
});

export const MapAiInputToViewportOutputSchema = z.object({
  kind: z.literal("map-ai-input-to-viewport"),
  mappedToExecutionSpace: z.literal(true),
}).merge(ExecutableGeometryOutputSchema);

export const MapRegionToSourceOutputSchema = z.object({
  kind: z.literal("map-region-to-source"),
  mappedToExecutionSpace: z.literal(true),
}).merge(ExecutableGeometryOutputSchema);

export const ValidateBrowserViewportBoundsOutputSchema = z.object({
  kind: z.literal("validate-browser-viewport-bounds"),
  boundsAccepted: z.literal(true),
}).merge(ExecutableGeometryOutputSchema.extend({
  normalizedCoordinateSpace: z.literal("browserViewport"),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
}));

export const ValidateDesktopScreenBoundsOutputSchema = z.object({
  kind: z.literal("validate-desktop-screen-bounds"),
  boundsAccepted: z.literal(true),
}).merge(ExecutableGeometryOutputSchema.extend({
  normalizedCoordinateSpace: z.literal("desktopScreen"),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
}));

export const GeometryGuardResultOutputSchema = z.discriminatedUnion("kind", [
  ValidateCoordinateSpaceOutputSchema,
  ValidateBBoxIntegrityOutputSchema,
  ValidateClickPointOutputSchema,
  ValidateScaleMappingOutputSchema,
  MapAiInputToViewportOutputSchema,
  MapRegionToSourceOutputSchema,
  ValidateBrowserViewportBoundsOutputSchema,
  ValidateDesktopScreenBoundsOutputSchema,
]);

export const GeometryGuardRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: z.string().min(1),
  missionId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  inputRef: nullableString,
  outputRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceAiResultRef: nullableString,
  sourceCoordinateSpace: GeometryGuardCoordinateSpaceSchema,
  requestedExecutionSpace: GeometryGuardExecutionSpaceSchema,
  normalizedCoordinateSpace: GeometryGuardExecutionSpaceSchema.nullable().default(null),
  sourceBounds: GeometryGuardBoundingBoxSchema.nullable().default(null),
  targetBounds: GeometryGuardBoundingBoxSchema.nullable().default(null),
  bboxBefore: GeometryGuardBoundingBoxSchema.nullable().default(null),
  bboxAfter: GeometryGuardBoundingBoxSchema.nullable().default(null),
  clickPointBefore: GeometryGuardPointSchema.nullable().default(null),
  clickPointAfter: GeometryGuardPointSchema.nullable().default(null),
  scaleMappingRef: nullableString,
  deviceScaleFactor: positiveFiniteNumber.nullable().default(null),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  status: GeometryGuardStatusSchema,
  guardDecision: GeometryGuardDecisionSchema,
  failureReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  policyDecision: GeometryGuardCheckDecisionSchema,
  boundsDecision: GeometryGuardCheckDecisionSchema,
  scaleDecision: GeometryGuardCheckDecisionSchema,
  transformDecision: GeometryGuardCheckDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

const GeometryGuardBaseResultSchema = z.object({
  status: GeometryGuardStatusSchema,
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  geometryGuardRef: z.string().min(1),
  guardDecision: GeometryGuardDecisionSchema,
  output: GeometryGuardResultOutputSchema.nullable().default(null),
  normalizedCoordinateSpace: GeometryGuardExecutionSpaceSchema.nullable().default(null),
  normalizedClickPoint: GeometryGuardPointSchema.nullable().default(null),
  normalizedBbox: GeometryGuardBoundingBoxSchema.nullable().default(null),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
  sourceScreenshotEvidenceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceAiResultRef: nullableString,
  failureReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  reviewRequiredReason: GeometryGuardFailureReasonSchema.nullable().default(null),
  debugLogRef: nullableString,
  runtimeProof: GeometryGuardRuntimeProofSchema,
  policyDecision: GeometryGuardCheckDecisionSchema,
  boundsDecision: GeometryGuardCheckDecisionSchema,
  scaleDecision: GeometryGuardCheckDecisionSchema,
  transformDecision: GeometryGuardCheckDecisionSchema,
  dataQualityFlags: z.array(z.string().min(1)).default([]),
  statusMessage: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
});

const createChildResultSchema = (childCapabilityId: typeof GEOMETRY_GUARD_CHILD_CAPABILITY_IDS[number]) =>
  GeometryGuardBaseResultSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });

export const ValidateCoordinateSpaceResultSchema = createChildResultSchema("validate-coordinate-space");
export const ValidateBBoxIntegrityResultSchema = createChildResultSchema("validate-bbox-integrity");
export const ValidateClickPointResultSchema = createChildResultSchema("validate-click-point");
export const ValidateScaleMappingResultSchema = createChildResultSchema("validate-scale-mapping");
export const MapAiInputToViewportResultSchema = createChildResultSchema("map-ai-input-to-viewport");
export const MapRegionToSourceResultSchema = createChildResultSchema("map-region-to-source");
export const ValidateBrowserViewportBoundsResultSchema = createChildResultSchema("validate-browser-viewport-bounds");
export const ValidateDesktopScreenBoundsResultSchema = createChildResultSchema("validate-desktop-screen-bounds");

export const GeometryGuardAbilityResultSchema = z.discriminatedUnion("childCapabilityId", [
  ValidateCoordinateSpaceResultSchema,
  ValidateBBoxIntegrityResultSchema,
  ValidateClickPointResultSchema,
  ValidateScaleMappingResultSchema,
  MapAiInputToViewportResultSchema,
  MapRegionToSourceResultSchema,
  ValidateBrowserViewportBoundsResultSchema,
  ValidateDesktopScreenBoundsResultSchema,
]);