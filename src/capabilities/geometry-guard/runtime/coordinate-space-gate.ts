import type { GeometryGuardCheckDecision, GeometryGuardChildCapabilityId, GeometryGuardCoordinateSpace, GeometryGuardExecutionSpace, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";

type ChildRoute = {
  childCapabilityId: GeometryGuardChildCapabilityId;
  sourceSpaces: readonly GeometryGuardCoordinateSpace[];
  requestedSpaces: readonly GeometryGuardExecutionSpace[];
  executableOutput: boolean;
  requiresScaleMapping: boolean;
};

const CHILD_ROUTES: Record<GeometryGuardChildCapabilityId, ChildRoute> = {
  "validate-coordinate-space": { childCapabilityId: "validate-coordinate-space", sourceSpaces: ["browserViewport", "desktopScreen", "contactSheet"], requestedSpaces: ["browserViewport", "desktopScreen"], executableOutput: false, requiresScaleMapping: false },
  "validate-bbox-integrity": { childCapabilityId: "validate-bbox-integrity", sourceSpaces: ["browserViewport", "desktopScreen", "imageEvidence", "aiInput", "regionCrop"], requestedSpaces: ["browserViewport", "desktopScreen"], executableOutput: false, requiresScaleMapping: false },
  "validate-click-point": { childCapabilityId: "validate-click-point", sourceSpaces: ["browserViewport", "desktopScreen", "imageEvidence", "aiInput", "regionCrop"], requestedSpaces: ["browserViewport", "desktopScreen"], executableOutput: false, requiresScaleMapping: false },
  "validate-scale-mapping": { childCapabilityId: "validate-scale-mapping", sourceSpaces: ["imageEvidence", "aiInput", "regionCrop"], requestedSpaces: ["browserViewport", "desktopScreen"], executableOutput: false, requiresScaleMapping: true },
  "map-ai-input-to-viewport": { childCapabilityId: "map-ai-input-to-viewport", sourceSpaces: ["aiInput"], requestedSpaces: ["browserViewport"], executableOutput: true, requiresScaleMapping: true },
  "map-region-to-source": { childCapabilityId: "map-region-to-source", sourceSpaces: ["imageEvidence", "regionCrop"], requestedSpaces: ["browserViewport", "desktopScreen"], executableOutput: true, requiresScaleMapping: true },
  "validate-browser-viewport-bounds": { childCapabilityId: "validate-browser-viewport-bounds", sourceSpaces: ["browserViewport"], requestedSpaces: ["browserViewport"], executableOutput: true, requiresScaleMapping: false },
  "validate-desktop-screen-bounds": { childCapabilityId: "validate-desktop-screen-bounds", sourceSpaces: ["desktopScreen"], requestedSpaces: ["desktopScreen"], executableOutput: true, requiresScaleMapping: false },
};

export type CoordinateSpaceGateResult = {
  childRoute: ChildRoute;
  coordinateDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
};

type CoordinateSpaceRuleInput = {
  request: ParsedGeometryGuardAbilityInput;
  childRoute: ChildRoute;
};

type CoordinateSpaceRule = (input: CoordinateSpaceRuleInput) => CoordinateSpaceGateResult | null;

function createCoordinateSpaceResult(input: {
  childRoute: ChildRoute;
  coordinateDecision: GeometryGuardCheckDecision;
  failure: GeometryFailure | null;
}): CoordinateSpaceGateResult {
  return {
    childRoute: input.childRoute,
    coordinateDecision: input.coordinateDecision,
    failure: input.failure,
  };
}

function validateSourceSpace(input: {
  request: ParsedGeometryGuardAbilityInput;
  childRoute: ChildRoute;
}): CoordinateSpaceGateResult | null {
  return input.childRoute.sourceSpaces.includes(input.request.sourceCoordinateSpace)
    ? null
    : createCoordinateSpaceResult({
        childRoute: input.childRoute,
        coordinateDecision: "failed",
        failure: createGeometryFailure({
          status: "failed",
          failureReason: "child_execution_mismatch",
          message: `Geometry Guard child ${input.request.childCapabilityId} cannot execute ${input.request.sourceCoordinateSpace}.`,
        }),
      });
}

function validateRequestedSpace(input: {
  request: ParsedGeometryGuardAbilityInput;
  childRoute: ChildRoute;
}): CoordinateSpaceGateResult | null {
  return input.childRoute.requestedSpaces.includes(input.request.requestedExecutionSpace)
    ? null
    : createCoordinateSpaceResult({
        childRoute: input.childRoute,
        coordinateDecision: "failed",
        failure: createGeometryFailure({
          status: "failed",
          failureReason: "requested_execution_space_mismatch",
          message: `Geometry Guard child ${input.request.childCapabilityId} cannot normalize into ${input.request.requestedExecutionSpace}.`,
        }),
      });
}

function validateContactSheetRule(input: {
  request: ParsedGeometryGuardAbilityInput;
  childRoute: ChildRoute;
}): CoordinateSpaceGateResult | null {
  if (input.request.sourceCoordinateSpace !== "contactSheet") {
    return null;
  }

  const coordinateDecision = input.request.safetyPolicy.allowReviewRequired ? "review_required" : "failed";
  return createCoordinateSpaceResult({
    childRoute: input.childRoute,
    coordinateDecision,
    failure: createGeometryFailure({
      status: coordinateDecision,
      failureReason: "contact_sheet_coordinate_not_executable",
      message: "Geometry Guard never promotes contactSheet coordinates into executable space.",
    }),
  });
}

function validateDesktopScaleFactor(input: {
  request: ParsedGeometryGuardAbilityInput;
  childRoute: ChildRoute;
}): CoordinateSpaceGateResult | null {
  return input.request.requestedExecutionSpace !== "desktopScreen" || input.request.deviceScaleFactor !== null
    ? null
    : createCoordinateSpaceResult({
        childRoute: input.childRoute,
        coordinateDecision: "failed",
        failure: createGeometryFailure({
          status: "failed",
          failureReason: "device_scale_factor_missing",
          message: "Geometry Guard requires deviceScaleFactor for desktopScreen execution.",
        }),
      });
}

const COORDINATE_SPACE_RULES: CoordinateSpaceRule[] = [
  validateSourceSpace,
  validateRequestedSpace,
  validateContactSheetRule,
  validateDesktopScaleFactor,
];

function runCoordinateSpaceRules(input: CoordinateSpaceRuleInput): CoordinateSpaceGateResult | null {
  for (const rule of COORDINATE_SPACE_RULES) {
    const result = rule(input);
    if (result) {
      return result;
    }
  }

  return null;
}

export function evaluateCoordinateSpace(input: ParsedGeometryGuardAbilityInput): CoordinateSpaceGateResult {
  const childRoute = CHILD_ROUTES[input.childCapabilityId];
  return runCoordinateSpaceRules({ request: input, childRoute }) ?? createCoordinateSpaceResult({ childRoute, coordinateDecision: "passed", failure: null });
}