import type { GeometryGuardCheckDecision, ParsedGeometryGuardAbilityInput } from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID, GEOMETRY_GUARD_CHILD_CAPABILITY_IDS, GEOMETRY_GUARD_COORDINATE_SPACES } from "../shared/geometry-types.js";
import { createGeometryFailure, type GeometryFailure } from "../shared/geometry-failure.js";

const REQUIRED_CHAIN_ALLOW_FIELDS = [
  "missionId",
  "runId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "inputRef",
  "sourceRef",
  "idempotencyKey",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function hasStringValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasChildCapabilityId(value: unknown): value is ParsedGeometryGuardAbilityInput["childCapabilityId"] {
  return typeof value === "string" && GEOMETRY_GUARD_CHILD_CAPABILITY_IDS.includes(value as ParsedGeometryGuardAbilityInput["childCapabilityId"]);
}

function hasCoordinateSpace(value: unknown): value is ParsedGeometryGuardAbilityInput["sourceCoordinateSpace"] {
  return typeof value === "string" && GEOMETRY_GUARD_COORDINATE_SPACES.includes(value as ParsedGeometryGuardAbilityInput["sourceCoordinateSpace"]);
}

type GeometryInputPolicyRule = (input: ParsedGeometryGuardAbilityInput) => GeometryFailure | null;

const SOURCE_EVIDENCE_FAILURE_REASONS: Partial<Record<string, GeometryFailure["failureReason"]>> = {
  sourceVisualTargetResultRef: "source_visual_target_result_missing",
  sourceAiResultRef: "source_ai_result_missing",
  sourceScreenshotEvidenceRef: "source_screenshot_evidence_missing",
  sourceGeometryHandoffRef: "source_geometry_handoff_missing",
  sourceRef: "source_ref_missing",
  sourceTargetRef: "source_ref_missing",
  upstreamEvidenceRef: "source_ref_missing",
};

function resolvePolicyStatus(input: ParsedGeometryGuardAbilityInput): GeometryFailure["status"] {
  return input.safetyPolicy.allowReviewRequired ? "review_required" : "failed";
}

function createInputPolicyFailure(input: ParsedGeometryGuardAbilityInput, value: {
  failureReason: GeometryFailure["failureReason"];
  message: string;
  dataQualityFlags?: string[];
}): GeometryFailure {
  const status = resolvePolicyStatus(input);
  return createGeometryFailure({
    status,
    failureReason: value.failureReason,
    message: value.message,
    policyDecision: status,
    ...(value.dataQualityFlags ? { dataQualityFlags: value.dataQualityFlags } : {}),
  });
}

function getMissingChainFields(input: ParsedGeometryGuardAbilityInput): string[] {
  return REQUIRED_CHAIN_ALLOW_FIELDS.filter((field) => !hasStringValue(input[field]));
}

function collectBaseMissingSourceEvidenceFields(input: ParsedGeometryGuardAbilityInput): string[] {
  const missing: string[] = [];
  const hasAnyUpstreamRef = [
    input.sourceScreenshotEvidenceRef,
    input.sourceTargetRef,
    input.sourceAiResultRef,
    input.sourceVisualTargetResultRef,
    input.sourceGeometryHandoffRef,
  ].some(hasStringValue);

  if (!hasStringValue(input.sourceAbilityGroupId)) {
    missing.push("sourceAbilityGroupId");
  }
  if (!hasStringValue(input.sourceRef)) {
    missing.push("sourceRef");
  }
  if (!hasAnyUpstreamRef) {
    missing.push("upstreamEvidenceRef");
  }

  return missing;
}

function collectVisualTargetMissingSourceFields(input: ParsedGeometryGuardAbilityInput): string[] {
  if (input.sourceAbilityGroupId !== "visual-target") {
    return [];
  }

  return [
    ...(hasStringValue(input.sourceVisualTargetResultRef) ? [] : ["sourceVisualTargetResultRef"]),
    ...(hasStringValue(input.sourceTargetRef) ? [] : ["sourceTargetRef"]),
  ];
}

function collectCoordinateSpaceMissingFields(input: ParsedGeometryGuardAbilityInput): string[] {
  const missing: string[] = [];

  if (input.sourceCoordinateSpace === "aiInput" && !hasStringValue(input.sourceAiResultRef)) {
    missing.push("sourceAiResultRef");
  }
  if (["imageEvidence", "contactSheet", "regionCrop"].includes(input.sourceCoordinateSpace) && !hasStringValue(input.sourceScreenshotEvidenceRef)) {
    missing.push("sourceScreenshotEvidenceRef");
  }
  if (input.sourceCoordinateSpace === "regionCrop" && !hasStringValue(input.sourceGeometryHandoffRef) && input.scaleMapping === null) {
    missing.push("sourceGeometryHandoffRef");
  }

  return missing;
}

function getMissingSourceEvidenceFields(input: ParsedGeometryGuardAbilityInput): string[] {
  return [
    ...collectBaseMissingSourceEvidenceFields(input),
    ...collectVisualTargetMissingSourceFields(input),
    ...collectCoordinateSpaceMissingFields(input),
  ];
}

function resolveSourceEvidenceFailureReason(fieldName: string): GeometryFailure["failureReason"] {
  return SOURCE_EVIDENCE_FAILURE_REASONS[fieldName] ?? "chain_field_missing";
}

export function resolveGeometrySourceEvidenceDecision(input: ParsedGeometryGuardAbilityInput): GeometryGuardCheckDecision {
  return getMissingChainFields(input).length === 0 && getMissingSourceEvidenceFields(input).length === 0
    ? "passed"
    : resolvePolicyStatus(input);
}

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

function validateChainFields(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  const missingField = getMissingChainFields(input)[0];
  return missingField
    ? createInputPolicyFailure(input, {
        failureReason: "chain_field_missing",
        message: `Geometry Guard requires ${missingField} before executable geometry can be approved.`,
        dataQualityFlags: [`missing_${missingField}`],
      })
    : null;
}

function validateSourceReference(input: ParsedGeometryGuardAbilityInput): GeometryFailure | null {
  const missingField = getMissingSourceEvidenceFields(input)[0];
  return missingField
    ? createInputPolicyFailure(input, {
        failureReason: resolveSourceEvidenceFailureReason(missingField),
        message: `Geometry Guard requires ${missingField} before executable geometry can be approved.`,
        dataQualityFlags: [`missing_${missingField}`],
      })
    : null;
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
  validateChainFields,
  validateSourceReference,
  validateConfidenceThreshold,
];

function createDefaultFailureSafetyPolicy() {
  return {
    allowReviewRequired: false,
    minimumConfidence: null,
    coordinateConfidence: null,
    requireSourceRef: true,
    clickSafetyMarginPx: 4,
    roundingPolicy: "nearest_pixel" as const,
  };
}

function buildFailureChainFields(record: Record<string, unknown>) {
  return {
    missionId: readString(record.missionId), runId: readString(record.runId), sessionId: readString(record.sessionId) ?? "geometry-guard:invalid-input",
    roundId: readString(record.roundId), videoVisitId: readString(record.videoVisitId), stepId: readString(record.stepId), mapPackageId: readString(record.mapPackageId),
    mapPackageVersion: readString(record.mapPackageVersion), selectedMapId: readString(record.selectedMapId), selectedMapVersion: readString(record.selectedMapVersion),
    activationSnapshotRef: readString(record.activationSnapshotRef), capabilityCallId: readString(record.capabilityCallId), nerveBusEnvelopeId: readString(record.nerveBusEnvelopeId),
  };
}

function buildFailureSourceFields(record: Record<string, unknown>) {
  return {
    sourceAbilityGroupId: readString(record.sourceAbilityGroupId), sourceChildCapabilityId: readString(record.sourceChildCapabilityId), inputRef: readString(record.inputRef),
    sourceRef: readString(record.sourceRef), sourceScreenshotEvidenceRef: readString(record.sourceScreenshotEvidenceRef), sourceTargetRef: readString(record.sourceTargetRef),
    sourceAiResultRef: readString(record.sourceAiResultRef), sourcePageStateProofRef: readString(record.sourcePageStateProofRef),
    sourceVisualTargetResultRef: readString(record.sourceVisualTargetResultRef), sourceGeometryHandoffRef: readString(record.sourceGeometryHandoffRef),
  };
}

function buildFailureGeometryFields(record: Record<string, unknown>): Pick<
  ParsedGeometryGuardAbilityInput,
  | "sourceCoordinateSpace"
  | "requestedExecutionSpace"
  | "bbox"
  | "clickPoint"
  | "imageSize"
  | "viewportSize"
  | "screenSize"
  | "deviceScaleFactor"
  | "scaleMapping"
  | "idempotencyKey"
> {
  return {
    sourceCoordinateSpace: hasCoordinateSpace(record.sourceCoordinateSpace) ? record.sourceCoordinateSpace : "contactSheet",
    requestedExecutionSpace: record.requestedExecutionSpace === "desktopScreen" ? "desktopScreen" : "browserViewport",
    bbox: null,
    clickPoint: null,
    imageSize: null,
    viewportSize: null,
    screenSize: null,
    deviceScaleFactor: null,
    scaleMapping: null,
    idempotencyKey: readString(record.idempotencyKey),
  };
}

export function coerceGeometryGuardFailureInput(rawInput: unknown): ParsedGeometryGuardAbilityInput {
  const record = isRecord(rawInput) ? rawInput : {};
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: hasChildCapabilityId(record.childCapabilityId) ? record.childCapabilityId : "validate-coordinate-space",
    ...buildFailureChainFields(record),
    requestedBy: readString(record.requestedBy) ?? "unknown",
    purpose: readString(record.purpose) ?? "invalid_geometry_input",
    ...buildFailureSourceFields(record),
    ...buildFailureGeometryFields(record),
    safetyPolicy: createDefaultFailureSafetyPolicy(),
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