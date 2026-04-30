import type { ParsedGeometryGuardAbilityInput } from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS, GEOMETRY_GUARD_COORDINATE_SPACES } from "../shared/geometry-types.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function hasChildCapabilityId(value: unknown): value is ParsedGeometryGuardAbilityInput["childCapabilityId"] {
  return typeof value === "string" && GEOMETRY_GUARD_CHILD_CAPABILITY_IDS.includes(value as ParsedGeometryGuardAbilityInput["childCapabilityId"]);
}

function hasCoordinateSpace(value: unknown): value is ParsedGeometryGuardAbilityInput["sourceCoordinateSpace"] {
  return typeof value === "string" && GEOMETRY_GUARD_COORDINATE_SPACES.includes(value as ParsedGeometryGuardAbilityInput["sourceCoordinateSpace"]);
}

type GeometryInputPolicyRule = (input: ParsedGeometryGuardAbilityInput) => GeometryFailure | null;

function validateRequestedBy(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  return input.requestedBy.trim()
    ? null
    : createGeometryFailure({
        status: "failed",
        failureReason: "missing_requested_by",
        message: "Geometry Guard requires requestedBy.",
        policyDecision: "failed",
      });
}

function validatePurpose(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  return input.purpose.trim()
    ? null
    : createGeometryFailure({
        status: "failed",
        failureReason: "missing_purpose",
        message: "Geometry Guard requires purpose.",
        policyDecision: "failed",
      });
}

function validateSourceReference(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  if (!input.safetyPolicy.requireSourceRef || input.sourceScreenshotEvidenceRef || input.sourceTargetRef || input.sourceAiResultRef) {
    return null;
  }

  return createGeometryFailure({
    status: "failed",
    failureReason: "missing_source_ref",
    message: "Geometry Guard requires at least one source reference.",
    policyDecision: "failed",
  });
}

function validateConfidenceThreshold(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  if (input.safetyPolicy.minimumConfidence === null || input.safetyPolicy.coordinateConfidence === null || input.safetyPolicy.coordinateConfidence >= input.safetyPolicy.minimumConfidence) {
    return null;
  }

  const status = input.safetyPolicy.allowReviewRequired ? "review_required" : "failed";
  return createGeometryFailure({
    status,
    failureReason: "confidence_below_threshold",
    message: "Geometry Guard blocked low-confidence coordinates.",
    policyDecision: status,
    dataQualityFlags: ["low_confidence"],
  });
}

const GEOMETRY_INPUT_POLICY_RULES: GeometryInputPolicyRule[] = [
  validateRequestedBy,
  validatePurpose,
  validateSourceReference,
  validateConfidenceThreshold,
];

export function coerceGeometryGuardFailureInput(rawInput: unknown): ParsedGeometryGuardAbilityInput {
  const record = isRecord(rawInput) ? rawInput : {};
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: hasChildCapabilityId(record.childCapabilityId) ? record.childCapabilityId : "validate-coordinate-space",
    sessionId: readString(record.sessionId) ?? "geometry-guard:invalid-input",
    roundId: readString(record.roundId),
    videoVisitId: readString(record.videoVisitId),
    requestedBy: readString(record.requestedBy) ?? "unknown",
    purpose: readString(record.purpose) ?? "invalid_geometry_input",
    sourceAbilityGroupId: readString(record.sourceAbilityGroupId),
    sourceChildCapabilityId: readString(record.sourceChildCapabilityId),
    inputRef: readString(record.inputRef),
    sourceScreenshotEvidenceRef: readString(record.sourceScreenshotEvidenceRef),
    sourceTargetRef: readString(record.sourceTargetRef),
    sourceAiResultRef: readString(record.sourceAiResultRef),
    sourceCoordinateSpace: hasCoordinateSpace(record.sourceCoordinateSpace) ? record.sourceCoordinateSpace : "contactSheet",
    requestedExecutionSpace: record.requestedExecutionSpace === "desktopScreen" ? "desktopScreen" : "browserViewport",
    bbox: null,
    clickPoint: null,
    imageSize: null,
    viewportSize: null,
    screenSize: null,
    deviceScaleFactor: null,
    scaleMapping: null,
    safetyPolicy: {
      allowReviewRequired: false,
      minimumConfidence: null,
      coordinateConfidence: null,
      requireSourceRef: true,
      clickSafetyMarginPx: 4,
      roundingPolicy: "nearest_pixel",
    },
    dataQualityFlags: [],
  };
}

export function evaluateGeometryInputPolicy(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  for (const rule of GEOMETRY_INPUT_POLICY_RULES) {
    const failure = rule(input);
    if (failure) {
      return failure;
    }
  }

  return null;
}