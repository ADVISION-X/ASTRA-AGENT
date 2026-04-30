import { z } from "zod";

import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "./shared/geometry-types.js";
import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardCheckDecisionSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardCoordinateSpaceSchema,
  GeometryGuardDecisionSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardFailureReasonSchema,
  GeometryGuardPointSchema,
  GeometryGuardStatusSchema,
} from "./schema-foundation.js";
import { nullableString, positiveFiniteNumber } from "./schema-internal.js";

const GeometryGuardRuntimeProofSchema = z.object({
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

export { GeometryGuardRuntimeProofSchema };