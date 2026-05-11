import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  type GeometryGuardAbilityResult,
  type GeometryGuardRuntimeProof,
  type ParsedGeometryGuardAbilityInput,
  type GeometryGuardPoint,
  type GeometryGuardBoundingBox,
} from "../contract.js";

export function buildAllowResult(params: {
  input: ParsedGeometryGuardAbilityInput;
  proof: GeometryGuardRuntimeProof;
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
}): GeometryGuardAbilityResult {
  const geometryGuardRef = params.proof.proofId;
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: params.input.childCapabilityId,
    status: "success",
    geometryGuardRef,
    guardDecision: "allow",
    normalizedCoordinateSpace: "browserViewport",
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
    sourceScreenshotEvidenceRef:
      params.input.sourceScreenshotEvidenceRef ?? null,
    failureReason: null,
    reviewRequiredReason: null,
    statusMessage: `Geometry Guard approved ${params.input.childCapabilityId}: executable coordinate confirmed.`,
    output: {
      childCapabilityId: params.input.childCapabilityId,
      geometryGuardRef,
      outputRef: geometryGuardRef,
      guardDecision: "allow",
      normalizedCoordinateSpace: "browserViewport",
      normalizedClickPoint: params.normalizedClickPoint,
      normalizedBbox: params.normalizedBbox,
      sourceScreenshotEvidenceRef:
        params.input.sourceScreenshotEvidenceRef ?? null,
      sourceTargetRef: params.input.sourceTargetRef ?? null,
      sourceVisualTargetResultRef:
        params.input.sourceVisualTargetResultRef ?? null,
      sourceAiResultRef: params.input.sourceAiResultRef ?? null,
      sourcePageStateProofRef: params.input.sourcePageStateProofRef ?? null,
    },
    runtimeProof: params.proof,
    startedAt: params.proof.startedAt,
    endedAt: params.proof.endedAt,
    durationMs: params.proof.durationMs,
  };
}

export function buildDenyResult(params: {
  input: ParsedGeometryGuardAbilityInput;
  proof: GeometryGuardRuntimeProof;
  failureReason: string;
  statusMessage: string;
}): GeometryGuardAbilityResult {
  const geometryGuardRef = params.proof.proofId;
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: params.input.childCapabilityId,
    status: "failed",
    geometryGuardRef,
    guardDecision: "deny",
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    sourceScreenshotEvidenceRef:
      params.input.sourceScreenshotEvidenceRef ?? null,
    failureReason: params.failureReason,
    reviewRequiredReason: null,
    statusMessage: params.statusMessage,
    output: null,
    runtimeProof: params.proof,
    startedAt: params.proof.startedAt,
    endedAt: params.proof.endedAt,
    durationMs: params.proof.durationMs,
  };
}

export function buildInputSchemaInvalidResult(
  rawInput: unknown,
  startedAt: string,
  endedAt: string,
  durationMs: number,
): GeometryGuardAbilityResult {
  const raw = rawInput as Record<string, unknown>;
  const childCapabilityId =
    typeof raw.childCapabilityId === "string"
      ? (raw.childCapabilityId as "validate-click-grid-cell")
      : "validate-click-grid-cell";
  const sessionId =
    typeof raw.sessionId === "string" ? raw.sessionId : "unknown";
  const proofId = `geometry-guard:input-invalid:${Date.now()}`;
  return {
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId,
    status: "failed",
    geometryGuardRef: proofId,
    guardDecision: "deny",
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    sourceScreenshotEvidenceRef: null,
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    statusMessage: "Geometry Guard rejected invalid input schema.",
    output: null,
    runtimeProof: {
      proofId,
      abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
      childCapabilityId,
      missionId: null,
      runId: null,
      sessionId,
      roundId: null,
      stepId: null,
      capabilityCallId: null,
      nerveBusEnvelopeId: null,
      inputRef: null,
      sourceRef: null,
      sourceScreenshotEvidenceRef: null,
      sourceAbilityGroupId: null,
      sourceChildCapabilityId: null,
      gridSpecRef: null,
      sourceCoordinateSpace: "unknown",
      requestedExecutionSpace: "browserViewport",
      normalizedCoordinateSpace: null,
      normalizedClickPoint: null,
      normalizedBbox: null,
      guardDecision: "deny",
      failureReason: "input_schema_invalid",
      reviewRequiredReason: null,
      startedAt,
      endedAt,
      durationMs,
    },
    startedAt,
    endedAt,
    durationMs,
  };
}
