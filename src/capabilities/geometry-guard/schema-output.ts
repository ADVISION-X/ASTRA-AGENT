import { z } from "zod";

import {
  GeometryGuardBoundingBoxSchema,
  GeometryGuardExecutionSpaceSchema,
  GeometryGuardPointSchema,
  GeometryGuardScaleMappingSchema,
} from "./schema-foundation.js";

const ValidateCoordinateSpaceOutputSchema = z.object({
  kind: z.literal("validate-coordinate-space"),
  coordinateSpaceAccepted: z.literal(true),
});

const ValidateBBoxIntegrityOutputSchema = z.object({
  kind: z.literal("validate-bbox-integrity"),
  bboxAccepted: z.literal(true),
  sourceBounds: GeometryGuardBoundingBoxSchema,
});

const ValidateClickPointOutputSchema = z.object({
  kind: z.literal("validate-click-point"),
  clickPointAccepted: z.literal(true),
  clickSafetyMarginPx: z.number().finite().nonnegative(),
});

const ValidateScaleMappingOutputSchema = z.object({
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

const MapAiInputToViewportOutputSchema = z.object({
  kind: z.literal("map-ai-input-to-viewport"),
  mappedToExecutionSpace: z.literal(true),
}).merge(ExecutableGeometryOutputSchema);

const MapRegionToSourceOutputSchema = z.object({
  kind: z.literal("map-region-to-source"),
  mappedToExecutionSpace: z.literal(true),
}).merge(ExecutableGeometryOutputSchema);

const ValidateBrowserViewportBoundsOutputSchema = z.object({
  kind: z.literal("validate-browser-viewport-bounds"),
  boundsAccepted: z.literal(true),
}).merge(ExecutableGeometryOutputSchema.extend({
  normalizedCoordinateSpace: z.literal("browserViewport"),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
}));

const ValidateDesktopScreenBoundsOutputSchema = z.object({
  kind: z.literal("validate-desktop-screen-bounds"),
  boundsAccepted: z.literal(true),
}).merge(ExecutableGeometryOutputSchema.extend({
  normalizedCoordinateSpace: z.literal("desktopScreen"),
  appliedScaleMapping: GeometryGuardScaleMappingSchema.nullable().default(null),
}));

const GeometryGuardResultOutputSchema = z.discriminatedUnion("kind", [
  ValidateCoordinateSpaceOutputSchema,
  ValidateBBoxIntegrityOutputSchema,
  ValidateClickPointOutputSchema,
  ValidateScaleMappingOutputSchema,
  MapAiInputToViewportOutputSchema,
  MapRegionToSourceOutputSchema,
  ValidateBrowserViewportBoundsOutputSchema,
  ValidateDesktopScreenBoundsOutputSchema,
]);

export {
  GeometryGuardResultOutputSchema,
  MapAiInputToViewportOutputSchema,
  MapRegionToSourceOutputSchema,
  ValidateBBoxIntegrityOutputSchema,
  ValidateBrowserViewportBoundsOutputSchema,
  ValidateClickPointOutputSchema,
  ValidateCoordinateSpaceOutputSchema,
  ValidateDesktopScreenBoundsOutputSchema,
  ValidateScaleMappingOutputSchema,
};