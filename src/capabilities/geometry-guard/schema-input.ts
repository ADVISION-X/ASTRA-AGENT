import { z } from "zod";

import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  GEOMETRY_GUARD_CHILD_CAPABILITY_IDS,
} from "./shared/geometry-types.js";
import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardCoordinateSpaceSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardPointSchema,
  GeometryGuardSafetyPolicySchema,
  GeometryGuardScaleMappingSchema,
  GeometryGuardSizeSchema,
} from "./schema-foundation.js";
import { nullableString, positiveFiniteNumber } from "./schema-internal.js";

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

const createChildInputSchema = (childCapabilityId: (typeof GEOMETRY_GUARD_CHILD_CAPABILITY_IDS)[number]) =>
  GeometryGuardBaseInputSchema.extend({
    childCapabilityId: z.literal(childCapabilityId),
  });

const ValidateCoordinateSpaceInputSchema = createChildInputSchema("validate-coordinate-space");
const ValidateBBoxIntegrityInputSchema = createChildInputSchema("validate-bbox-integrity");
const ValidateClickPointInputSchema = createChildInputSchema("validate-click-point");
const ValidateScaleMappingInputSchema = createChildInputSchema("validate-scale-mapping");
const MapAiInputToViewportInputSchema = createChildInputSchema("map-ai-input-to-viewport");
const MapRegionToSourceInputSchema = createChildInputSchema("map-region-to-source");
const ValidateBrowserViewportBoundsInputSchema = createChildInputSchema("validate-browser-viewport-bounds");
const ValidateDesktopScreenBoundsInputSchema = createChildInputSchema("validate-desktop-screen-bounds");

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