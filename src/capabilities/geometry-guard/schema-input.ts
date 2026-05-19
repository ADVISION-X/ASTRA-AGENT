import { z } from "zod";

import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "./schema-constants.js";
import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardPointSchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardSizeSchema,
} from "./schema-primitives.js";

const nullableString = z.string().nullable().optional().default(null);

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
  deviceScaleFactor: z.number().finite().positive().nullable().optional().default(null),
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

