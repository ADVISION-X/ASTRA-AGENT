import { z } from "zod";

import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardChildCapabilityIdSchema,
  GeometryGuardCoordinateSpaceSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardPointSchema,
  GeometryGuardRoundingPolicySchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardScaleMappingSchema,
  GeometryGuardSizeSchema,
} from "./schema-foundation.js";
import { nullableString } from "./schema-internal.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "./shared/geometry-types.js";

const GeometryGuardBaseInputSchema = z.object({
  abilityGroupId: z.literal(GEOMETRY_GUARD_ABILITY_GROUP_ID),
  childCapabilityId: GeometryGuardChildCapabilityIdSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  idempotencyKey: nullableString,
  inputRef: nullableString,
  requestedBy: z.string().min(1),
  purpose: z.string().min(1),
  sourceAbilityGroupId: nullableString,
  sourceChildCapabilityId: nullableString,
  sourceCoordinateSpace: GeometryGuardCoordinateSpaceSchema,
  requestedExecutionSpace: GeometryGuardExecutionSpaceSchema,
  bbox: GeometryGuardBoundingBoxSchema.nullable().optional().default(null),
  clickPoint: GeometryGuardPointSchema.nullable().optional().default(null),
  scaleMapping: GeometryGuardScaleMappingSchema.nullable().optional().default(null),
  deviceScaleFactor: z.number().finite().positive().nullable().optional().default(null),
  imageSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  screenSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  viewportSize: GeometryGuardSizeSchema.nullable().optional().default(null),
  safetyPolicy: GeometryGuardSafetyPolicySchema,
  riskLevel: z.string().min(1).nullable().optional().default(null),
  sourceRef: nullableString,
  sourceTargetRef: nullableString,
  sourceVisualTargetResultRef: nullableString,
  sourceAiResultRef: nullableString,
  sourceScreenshotEvidenceRef: nullableString,
  sourceGeometryHandoffRef: nullableString,
  sourcePageStateProofRef: nullableString,
  upstreamEvidenceRef: nullableString,
  targetSemanticOwner: nullableString,
  fallbackReason: nullableString,
  actionableMessage: nullableString,
  requiresPostClickAiVerification: z.boolean().default(false),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
});

const ValidateCoordinateSpaceInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-coordinate-space"),
}).strict();

const ValidateBBoxIntegrityInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-bbox-integrity"),
}).strict();

const ValidateClickPointInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-click-point"),
}).strict();

const ValidateScaleMappingInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-scale-mapping"),
}).strict();

const MapAiInputToViewportInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("map-ai-input-to-viewport"),
}).strict();

const MapRegionToSourceInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("map-region-to-source"),
}).strict();

const ValidateBrowserViewportBoundsInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-browser-viewport-bounds"),
}).strict();

const ValidateDesktopScreenBoundsInputSchema = GeometryGuardBaseInputSchema.extend({
  childCapabilityId: z.literal("validate-desktop-screen-bounds"),
}).strict();

const GeometryGuardAbilityInputSchema = z.discriminatedUnion("childCapabilityId", [
  ValidateCoordinateSpaceInputSchema,
  ValidateBBoxIntegrityInputSchema,
  ValidateClickPointInputSchema,
  ValidateScaleMappingInputSchema,
  MapAiInputToViewportInputSchema,
  MapRegionToSourceInputSchema,
  ValidateBrowserViewportBoundsInputSchema,
  ValidateDesktopScreenBoundsInputSchema,
]);

export {
  GeometryGuardAbilityInputSchema,
  MapAiInputToViewportInputSchema,
  MapRegionToSourceInputSchema,
  ValidateBBoxIntegrityInputSchema,
  ValidateBrowserViewportBoundsInputSchema,
  ValidateClickPointInputSchema,
  ValidateCoordinateSpaceInputSchema,
  ValidateDesktopScreenBoundsInputSchema,
  ValidateScaleMappingInputSchema,
};
