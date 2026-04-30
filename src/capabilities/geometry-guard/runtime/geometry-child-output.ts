import type {
  GeometryGuardResultOutput,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import type { buildGeometryGuardResult } from "./geometry-result-builder.js";

type GeometryChildOutputInput = {
  request: ParsedGeometryGuardAbilityInput;
  sourceBounds: Parameters<typeof buildGeometryGuardResult>[0]["sourceBounds"];
  targetBounds: Parameters<typeof buildGeometryGuardResult>[0]["targetBounds"];
  appliedScaleMapping: Parameters<typeof buildGeometryGuardResult>[0]["appliedScaleMapping"];
  normalizedCoordinateSpace: Parameters<typeof buildGeometryGuardResult>[0]["normalizedCoordinateSpace"];
  normalizedClickPoint: Parameters<typeof buildGeometryGuardResult>[0]["normalizedClickPoint"];
  normalizedBbox: Parameters<typeof buildGeometryGuardResult>[0]["normalizedBbox"];
};

const buildScaleMappingOutput = (input: GeometryChildOutputInput): GeometryGuardResultOutput | null =>
  input.sourceBounds && input.targetBounds && input.appliedScaleMapping
    ? {
        kind: "validate-scale-mapping",
        scaleMappingAccepted: true,
        sourceBounds: input.sourceBounds,
        targetBounds: input.targetBounds,
        appliedScaleMapping: input.appliedScaleMapping,
      }
    : null;

const buildMappedOutput = (
  kind: "map-ai-input-to-viewport" | "map-region-to-source",
  input: GeometryChildOutputInput,
): GeometryGuardResultOutput | null =>
  input.normalizedCoordinateSpace && input.normalizedClickPoint && input.normalizedBbox
    ? {
        kind,
        mappedToExecutionSpace: true,
        normalizedCoordinateSpace: input.normalizedCoordinateSpace,
        normalizedClickPoint: input.normalizedClickPoint,
        normalizedBbox: input.normalizedBbox,
        appliedScaleMapping: input.appliedScaleMapping,
      }
    : null;

const buildViewportBoundsOutput = (input: GeometryChildOutputInput): GeometryGuardResultOutput | null =>
  input.normalizedCoordinateSpace === "browserViewport" && input.normalizedClickPoint && input.normalizedBbox
    ? {
        kind: "validate-browser-viewport-bounds",
        boundsAccepted: true,
        normalizedCoordinateSpace: "browserViewport",
        normalizedClickPoint: input.normalizedClickPoint,
        normalizedBbox: input.normalizedBbox,
        appliedScaleMapping: input.appliedScaleMapping,
      }
    : null;

const buildDesktopBoundsOutput = (input: GeometryChildOutputInput): GeometryGuardResultOutput | null =>
  input.normalizedCoordinateSpace === "desktopScreen" && input.normalizedClickPoint && input.normalizedBbox
    ? {
        kind: "validate-desktop-screen-bounds",
        boundsAccepted: true,
        normalizedCoordinateSpace: "desktopScreen",
        normalizedClickPoint: input.normalizedClickPoint,
        normalizedBbox: input.normalizedBbox,
        appliedScaleMapping: input.appliedScaleMapping,
      }
    : null;

const buildCoordinateSpaceOutput = (): GeometryGuardResultOutput => ({
  kind: "validate-coordinate-space",
  coordinateSpaceAccepted: true,
});

const buildBboxIntegrityOutput = (input: GeometryChildOutputInput): GeometryGuardResultOutput | null =>
  input.sourceBounds
    ? { kind: "validate-bbox-integrity", bboxAccepted: true, sourceBounds: input.sourceBounds }
    : null;

const buildClickPointOutput = (input: GeometryChildOutputInput): GeometryGuardResultOutput => ({
  kind: "validate-click-point",
  clickPointAccepted: true,
  clickSafetyMarginPx: input.request.safetyPolicy.clickSafetyMarginPx,
});

const CHILD_OUTPUT_BUILDERS: Record<GeometryChildOutputInput["request"]["childCapabilityId"], (input: GeometryChildOutputInput) => GeometryGuardResultOutput | null> = {
  "validate-coordinate-space": () => buildCoordinateSpaceOutput(),
  "validate-bbox-integrity": buildBboxIntegrityOutput,
  "validate-click-point": (input) => buildClickPointOutput(input),
  "validate-scale-mapping": buildScaleMappingOutput,
  "map-ai-input-to-viewport": (input) => buildMappedOutput("map-ai-input-to-viewport", input),
  "map-region-to-source": (input) => buildMappedOutput("map-region-to-source", input),
  "validate-browser-viewport-bounds": buildViewportBoundsOutput,
  "validate-desktop-screen-bounds": buildDesktopBoundsOutput,
};

export function buildGeometryChildOutput(input: GeometryChildOutputInput): GeometryGuardResultOutput | null {
  return CHILD_OUTPUT_BUILDERS[input.request.childCapabilityId](input);
}