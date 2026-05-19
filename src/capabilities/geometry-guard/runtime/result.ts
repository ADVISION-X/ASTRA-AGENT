import {
  type GeometryGuardAbilityResult,
  type ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GEOMETRY_GUARD_ABILITY_GROUP_ID } from "../schema-constants.js";
import type {
  GeometryGuardBoundingBox,
  GeometryGuardPoint,
} from "../geometry-types.js";
import type {
  GeometryGuardOutput,
  GeometryGuardRuntimeProof,
} from "../geometry-io-types.js";

export function buildAllowResult(params: {
  input: ParsedGeometryGuardAbilityInput;
  proof: GeometryGuardRuntimeProof;
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
}): GeometryGuardAbilityResult {
  const geometryGuardRef = params.proof.proofId;
  const output = buildAllowOutput({
    input: params.input,
    geometryGuardRef,
    normalizedClickPoint: params.normalizedClickPoint,
    normalizedBbox: params.normalizedBbox,
  });
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
    output,
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
  const childCapabilityId = readInvalidChildCapabilityId(raw);
  const sessionId = readInvalidSessionId(raw);
  const proofId = `geometry-guard:input-invalid:${Date.now()}`;
  const runtimeProof = buildInvalidRuntimeProof({
    childCapabilityId,
    sessionId,
    proofId,
    startedAt,
    endedAt,
    durationMs,
  });
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
    runtimeProof,
    startedAt,
    endedAt,
    durationMs,
  };
}

function buildAllowOutput(params: {
  input: ParsedGeometryGuardAbilityInput;
  geometryGuardRef: string;
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
}): GeometryGuardOutput {
  return {
    childCapabilityId: params.input.childCapabilityId,
    geometryGuardRef: params.geometryGuardRef,
    outputRef: params.geometryGuardRef,
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
  };
}

function readInvalidChildCapabilityId(
  raw: Record<string, unknown>,
): "validate-click-grid-cell" {
  return typeof raw.childCapabilityId === "string"
    ? (raw.childCapabilityId as "validate-click-grid-cell")
    : "validate-click-grid-cell";
}

function readInvalidSessionId(raw: Record<string, unknown>): string {
  return typeof raw.sessionId === "string" ? raw.sessionId : "unknown";
}

function buildInvalidRuntimeProof(params: {
  childCapabilityId: "validate-click-grid-cell";
  sessionId: string;
  proofId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
}): GeometryGuardRuntimeProof {
  return {
    proofId: params.proofId,
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: params.childCapabilityId,
    ...emptyInvalidProofIdentity(params.sessionId),
    sourceCoordinateSpace: "unknown",
    requestedExecutionSpace: "browserViewport",
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    guardDecision: "deny",
    failureReason: "input_schema_invalid",
    reviewRequiredReason: null,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationMs: params.durationMs,
  };
}

function emptyInvalidProofIdentity(sessionId: string) {
  return {
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
  };
}
