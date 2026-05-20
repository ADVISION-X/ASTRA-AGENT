import type { MouseScrollCoordinateSpace, MouseScrollRegion, ParsedMouseScrollAbilityInput } from "../contract.js";

const MAX_ALLOWED_BOUND = 12_000;
type PreScrollSafetyFailureReason =
  | "invalid_coordinate_space"
  | "invalid_bounds"
  | "invalid_region"
  | "anchor_out_of_bounds"
  | "anchor_outside_region"
  | "invalid_repeat"
  | "invalid_duration_limit"
  | "invalid_primitive_timeout"
  | "invalid_delta_limit"
  | "bounds_too_large";

type PreScrollSafetySuccess = {
  ok: true;
  requestedAnchor: { x: number; y: number };
  executableAnchor: { x: number; y: number };
  bounds: { width: number; height: number };
  region: MouseScrollRegion | null;
  coordinateRoundingDecision: string;
  safetyDecision: "allow";
  safetyDecisionReason: string;
};
type PreScrollSafetyFailure = {
  ok: false;
  status: "failed";
  failureReason: PreScrollSafetyFailureReason;
  statusMessage: string;
  policyDecision: "block";
  safetyDecision: "block";
  safetyDecisionReason: string;
  dataQualityFlags: string[];
};

const createPreScrollSafetyFailure = (input: {
  failureReason: PreScrollSafetyFailureReason;
  statusMessage: string;
  safetyDecisionReason: string;
  dataQualityFlags: string[];
}): PreScrollSafetyFailure => ({
  ok: false,
  status: "failed",
  failureReason: input.failureReason,
  statusMessage: input.statusMessage,
  policyDecision: "block",
  safetyDecision: "block",
  safetyDecisionReason: input.safetyDecisionReason,
  dataQualityFlags: input.dataQualityFlags,
});
const createPreScrollSafetySuccess = (input: {
  requestedAnchor: { x: number; y: number };
  executableAnchor: { x: number; y: number };
  bounds: { width: number; height: number };
  region: MouseScrollRegion | null;
}): PreScrollSafetySuccess => ({
  ok: true,
  requestedAnchor: input.requestedAnchor,
  executableAnchor: input.executableAnchor,
  bounds: input.bounds,
  region: input.region,
  coordinateRoundingDecision: "rounded_to_integer",
  safetyDecision: "allow",
  safetyDecisionReason: "bounds_and_anchor_valid",
});
function isPointWithinBounds(point: { x: number; y: number }, bounds: { width: number; height: number }): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < bounds.width && point.y < bounds.height;
}

function isRegionWithinBounds(region: MouseScrollRegion, bounds: { width: number; height: number }): boolean {
  return region.x >= 0
    && region.y >= 0
    && region.width > 0
    && region.height > 0
    && region.x + region.width <= bounds.width
    && region.y + region.height <= bounds.height;
}

function isPointWithinRegion(point: { x: number; y: number }, region: MouseScrollRegion): boolean {
  return point.x >= region.x
    && point.y >= region.y
    && point.x < region.x + region.width
    && point.y < region.y + region.height;
}
function regionsMatch(left: MouseScrollRegion, right: MouseScrollRegion): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

const validatePreScrollCoordinateSpace = (
  request: ParsedMouseScrollAbilityInput,
  expectedCoordinateSpace: MouseScrollCoordinateSpace,
): PreScrollSafetyFailure | null => {
  return request.coordinateSpace === expectedCoordinateSpace
    ? null
    : createPreScrollSafetyFailure({
        failureReason: "invalid_coordinate_space",
        statusMessage: "Mouse Scroll coordinateSpace no longer matches this child capability.",
        safetyDecisionReason: "coordinate_space_mismatch",
        dataQualityFlags: ["coordinate_space_mismatch"],
      });
};

const validatePreScrollBounds = (request: ParsedMouseScrollAbilityInput): PreScrollSafetyFailure | null => {
  const bounds = request.bounds;
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return createPreScrollSafetyFailure({
      failureReason: "invalid_bounds",
      statusMessage: "Mouse Scroll bounds must be finite positive dimensions.",
      safetyDecisionReason: "invalid_bounds",
      dataQualityFlags: ["invalid_bounds"],
    });
  }
  return bounds.width > MAX_ALLOWED_BOUND || bounds.height > MAX_ALLOWED_BOUND
    ? createPreScrollSafetyFailure({
        failureReason: "bounds_too_large",
        statusMessage: "Mouse Scroll bounds exceed the governed maximum size.",
        safetyDecisionReason: "bounds_too_large",
        dataQualityFlags: ["bounds_too_large"],
      })
    : null;
};

const validatePreScrollRepeatPolicy = (request: ParsedMouseScrollAbilityInput): PreScrollSafetyFailure | null => {
  if (!Number.isInteger(request.repeat) || request.repeat <= 0 || request.repeat > request.safetyPolicy.maxRepeat) {
    return createPreScrollSafetyFailure({
      failureReason: "invalid_repeat",
      statusMessage: "Mouse Scroll repeat must be a finite positive integer within maxRepeat.",
      safetyDecisionReason: "repeat_out_of_range",
      dataQualityFlags: ["invalid_repeat"],
    });
  }
  return null;
};

const validatePreScrollDurationPolicy = (request: ParsedMouseScrollAbilityInput): PreScrollSafetyFailure | null => {
  if (!Number.isFinite(request.safetyPolicy.maxDurationMs) || request.safetyPolicy.maxDurationMs <= 0) {
    return createPreScrollSafetyFailure({
      failureReason: "invalid_duration_limit",
      statusMessage: "Mouse Scroll requires a finite positive maxDurationMs.",
      safetyDecisionReason: "invalid_max_duration",
      dataQualityFlags: ["invalid_duration_limit"],
    });
  }
  if (
    !Number.isFinite(request.safetyPolicy.primitiveTimeoutMs)
    || request.safetyPolicy.primitiveTimeoutMs <= 0
    || request.safetyPolicy.primitiveTimeoutMs > request.safetyPolicy.maxDurationMs
  ) {
    return createPreScrollSafetyFailure({
      failureReason: "invalid_primitive_timeout",
      statusMessage: "Mouse Scroll requires a finite positive primitiveTimeoutMs.",
      safetyDecisionReason: "invalid_primitive_timeout",
      dataQualityFlags: ["invalid_primitive_timeout"],
    });
  }

  return !Number.isFinite(request.safetyPolicy.maxDeltaAbs) || request.safetyPolicy.maxDeltaAbs <= 0
    ? createPreScrollSafetyFailure({
        failureReason: "invalid_delta_limit",
        statusMessage: "Mouse Scroll requires a finite positive maxDeltaAbs.",
        safetyDecisionReason: "invalid_delta_limit",
        dataQualityFlags: ["invalid_delta_limit"],
      })
    : null;
};

const validateAnchorWithinBounds = (
  executableAnchor: { x: number; y: number },
  bounds: { width: number; height: number },
): PreScrollSafetyFailure | null => {
  return isPointWithinBounds(executableAnchor, bounds)
    ? null
    : createPreScrollSafetyFailure({
        failureReason: "anchor_out_of_bounds",
        statusMessage: "Mouse Scroll executableAnchor is outside the governed bounds window.",
        safetyDecisionReason: "anchor_out_of_bounds",
        dataQualityFlags: ["anchor_out_of_bounds"],
      });
};

const validateNonRegionScroll = (request: ParsedMouseScrollAbilityInput): PreScrollSafetyFailure | null => {
  return request.region === null && request.regionRef === null
    ? null
    : createPreScrollSafetyFailure({
        failureReason: "invalid_region",
        statusMessage: "Non-region Mouse Scroll children must not carry region or regionRef.",
        safetyDecisionReason: "unexpected_region_payload",
        dataQualityFlags: ["unexpected_region_payload"],
      });
};

const createRegionPayloadIncompleteFailure = () => createPreScrollSafetyFailure({
  failureReason: "invalid_region",
  statusMessage: "scroll-region requires region, regionRef, and Geometry Guard normalizedRegion proof.",
  safetyDecisionReason: "region_payload_incomplete",
  dataQualityFlags: ["region_payload_incomplete"],
});

const createRegionProofMismatchFailure = () => createPreScrollSafetyFailure({
  failureReason: "invalid_region",
  statusMessage: "scroll-region region must match Geometry Guard normalizedRegion exactly.",
  safetyDecisionReason: "region_proof_mismatch",
  dataQualityFlags: ["region_proof_mismatch"],
});

const createRegionOutOfBoundsFailure = () => createPreScrollSafetyFailure({
  failureReason: "invalid_region",
  statusMessage: "scroll-region region must stay inside the governed bounds window.",
  safetyDecisionReason: "region_out_of_bounds",
  dataQualityFlags: ["region_out_of_bounds"],
});

const createAnchorOutsideRegionFailure = () => createPreScrollSafetyFailure({
  failureReason: "anchor_outside_region",
  statusMessage: "scroll-region anchor must stay inside the Geometry Guard normalizedRegion.",
  safetyDecisionReason: "anchor_outside_region",
  dataQualityFlags: ["anchor_outside_region"],
});

const validateScrollRegionPayload = (
  request: ParsedMouseScrollAbilityInput,
  bounds: { width: number; height: number },
  executableAnchor: { x: number; y: number },
): PreScrollSafetyFailure | MouseScrollRegion => {
  const region = request.region;
  const proofRegion = request.geometryScrollProof.normalizedRegion;
  if (region === null || request.regionRef === null || proofRegion === null) {
    return createRegionPayloadIncompleteFailure();
  }
  if (!regionsMatch(region, proofRegion)) {
    return createRegionProofMismatchFailure();
  }
  if (!isRegionWithinBounds(region, bounds)) {
    return createRegionOutOfBoundsFailure();
  }

  return isPointWithinRegion(executableAnchor, region)
    ? region
    : createAnchorOutsideRegionFailure();
};

const buildExecutableAnchor = (requestedAnchor: { x: number; y: number }) => ({
  x: Math.round(requestedAnchor.x),
  y: Math.round(requestedAnchor.y),
});

const resolveValidatedRegion = (
  request: ParsedMouseScrollAbilityInput,
  bounds: { width: number; height: number },
  executableAnchor: { x: number; y: number },
): PreScrollSafetyFailure | MouseScrollRegion | null => {
  if (request.childCapabilityId !== "scroll-region") {
    return validateNonRegionScroll(request);
  }
  return validateScrollRegionPayload(request, bounds, executableAnchor);
};

const validateSharedPreScrollRules = (
  request: ParsedMouseScrollAbilityInput,
  expectedCoordinateSpace: MouseScrollCoordinateSpace,
  executableAnchor: { x: number; y: number },
): PreScrollSafetyFailure | null =>
  validatePreScrollCoordinateSpace(request, expectedCoordinateSpace)
  ?? validatePreScrollBounds(request)
  ?? validatePreScrollRepeatPolicy(request)
  ?? validatePreScrollDurationPolicy(request)
  ?? validateAnchorWithinBounds(executableAnchor, request.bounds);

export function validatePreScrollSafety(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
}):
  | PreScrollSafetySuccess
  | PreScrollSafetyFailure {
  const requestedAnchor = input.request.geometryScrollProof.normalizedAnchorPoint;
  const bounds = input.request.bounds;
  const executableAnchor = buildExecutableAnchor(requestedAnchor);
  const failure = validateSharedPreScrollRules(
    input.request,
    input.expectedCoordinateSpace,
    executableAnchor,
  );
  if (failure) {
    return failure;
  }

  const regionOutcome = resolveValidatedRegion(input.request, bounds, executableAnchor);
  if (regionOutcome && "ok" in regionOutcome) {
    return regionOutcome;
  }

  return createPreScrollSafetySuccess({
    requestedAnchor,
    executableAnchor,
    bounds,
    region: regionOutcome,
  });
}
