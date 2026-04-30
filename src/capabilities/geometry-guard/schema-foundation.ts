import { z } from "zod";

import {
  GEOMETRY_GUARD_CHECK_DECISIONS,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
  GEOMETRY_GUARD_COORDINATE_SPACES,
  GEOMETRY_GUARD_DECISIONS,
  GEOMETRY_GUARD_EXECUTION_SPACES,
  GEOMETRY_GUARD_FAILURE_REASONS,
  GEOMETRY_GUARD_RESULT_STATUSES,
  GEOMETRY_GUARD_ROUNDING_POLICIES,
} from "./shared/geometry-types.js";
import { finiteNumber, nullableString, positiveFiniteNumber } from "./schema-internal.js";

const GeometryGuardChildCapabilityIdSchema = z.enum(GEOMETRY_GUARD_CHILD_CAPABILITY_IDS);
const GeometryGuardCoordinateSpaceSchema = z.enum(GEOMETRY_GUARD_COORDINATE_SPACES);
const GeometryGuardExecutionSpaceSchema = z.enum(GEOMETRY_GUARD_EXECUTION_SPACES);
const GeometryGuardStatusSchema = z.enum(GEOMETRY_GUARD_RESULT_STATUSES);
const GeometryGuardDecisionSchema = z.enum(GEOMETRY_GUARD_DECISIONS);
const GeometryGuardCheckDecisionSchema = z.enum(GEOMETRY_GUARD_CHECK_DECISIONS);
const GeometryGuardFailureReasonSchema = z.enum(GEOMETRY_GUARD_FAILURE_REASONS);
const GeometryGuardRoundingPolicySchema = z.enum(GEOMETRY_GUARD_ROUNDING_POLICIES);

const GeometryGuardPointSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
});

const GeometryGuardBoundingBoxSchema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

const GeometryGuardSizeSchema = z.object({
  width: positiveFiniteNumber,
  height: positiveFiniteNumber,
});

const GeometryGuardScaleMappingSchema = z.object({
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

const GeometryGuardSafetyPolicySchema = z.object({
  allowReviewRequired: z.boolean().default(false),
  minimumConfidence: z.number().min(0).max(1).nullable().optional().default(null),
  coordinateConfidence: z.number().min(0).max(1).nullable().optional().default(null),
  requireSourceRef: z.boolean().default(true),
  clickSafetyMarginPx: z.number().finite().nonnegative().default(4),
  roundingPolicy: GeometryGuardRoundingPolicySchema.default("nearest_pixel"),
});

export {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardCheckDecisionSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardCoordinateSpaceSchema,
  GeometryGuardDecisionSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardFailureReasonSchema,
  GeometryGuardPointSchema,
  GeometryGuardRoundingPolicySchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardScaleMappingSchema,
  GeometryGuardSizeSchema,
  GeometryGuardStatusSchema,
};