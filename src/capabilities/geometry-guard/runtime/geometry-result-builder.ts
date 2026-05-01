import type {
  GeometryGuardAbilityResult,
  GeometryGuardBoundingBox,
  GeometryGuardCheckDecision,
  GeometryGuardDecision,
  GeometryGuardExecutionSpace,
  GeometryGuardFailureReason,
  GeometryGuardPoint,
  GeometryGuardResultOutput,
  GeometryGuardScaleMapping,
  GeometryGuardStatus,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GeometryGuardAbilityResultSchema } from "../schema.js";
import { buildStableGeometryRef } from "../shared/geometry-transform.js";
import { buildGeometryRuntimeProof } from "./geometry-proof-builder.js";

type BuildGeometryGuardResultInput = {
  request: ParsedGeometryGuardAbilityInput;
  status: GeometryGuardStatus;
  guardDecision: GeometryGuardDecision;
  output: GeometryGuardResultOutput | null;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
  failureReason: GeometryGuardFailureReason | null;
  reviewRequiredReason: GeometryGuardFailureReason | null;
  statusMessage: string;
  policyDecision: GeometryGuardCheckDecision;
  boundsDecision: GeometryGuardCheckDecision;
  scaleDecision: GeometryGuardCheckDecision;
  transformDecision: GeometryGuardCheckDecision;
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  dataQualityFlags: string[];
};

function buildGeometryResultRefs(input: BuildGeometryGuardResultInput) {
  const geometryGuardRef = buildStableGeometryRef([
    "geometry-guard",
    input.request.childCapabilityId,
    input.request.sessionId,
    input.request.roundId,
    input.request.videoVisitId,
    input.request.sourceTargetRef,
    input.request.sourceScreenshotEvidenceRef,
  ]);

  return {
    geometryGuardRef,
    outputRef: buildStableGeometryRef([geometryGuardRef, input.status, input.guardDecision]),
  };
}

function buildGeometryProofPayload(input: BuildGeometryGuardResultInput, refs: ReturnType<typeof buildGeometryResultRefs>) {
  return {
    request: input.request,
    geometryGuardRef: refs.geometryGuardRef,
    outputRef: refs.outputRef,
    output: input.output,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    normalizedBbox: input.normalizedBbox,
    normalizedClickPoint: input.normalizedClickPoint,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    status: input.status,
    guardDecision: input.guardDecision,
    policyDecision: input.policyDecision,
    boundsDecision: input.boundsDecision,
    scaleDecision: input.scaleDecision,
    transformDecision: input.transformDecision,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    dataQualityFlags: input.dataQualityFlags,
  };
}

function buildGeometryAuditPayload(input: BuildGeometryGuardResultInput) {
  return {
    policyDecision: input.policyDecision,
    boundsDecision: input.boundsDecision,
    scaleDecision: input.scaleDecision,
    transformDecision: input.transformDecision,
    dataQualityFlags: input.dataQualityFlags,
    statusMessage: input.statusMessage,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
  };
}

function buildGeometryCorePayload(input: BuildGeometryGuardResultInput, refs: ReturnType<typeof buildGeometryResultRefs>) {
  return {
    status: input.status,
    abilityGroupId: "geometry-guard",
    childCapabilityId: input.request.childCapabilityId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    geometryGuardRef: refs.geometryGuardRef,
    guardDecision: input.guardDecision,
    output: input.output,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    normalizedClickPoint: input.normalizedClickPoint,
    normalizedBbox: input.normalizedBbox,
    appliedScaleMapping: input.appliedScaleMapping,
    sourceScreenshotEvidenceRef: input.request.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.request.sourceTargetRef,
    sourceAiResultRef: input.request.sourceAiResultRef,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    debugLogRef: refs.outputRef,
  };
}

function buildGeometryResultPayload(input: BuildGeometryGuardResultInput, refs: ReturnType<typeof buildGeometryResultRefs>) {
  return {
    ...buildGeometryCorePayload(input, refs),
    runtimeProof: buildGeometryRuntimeProof(buildGeometryProofPayload(input, refs)),
    ...buildGeometryAuditPayload(input),
  };
}

export function buildGeometryGuardResult(input: BuildGeometryGuardResultInput): GeometryGuardAbilityResult {
  return GeometryGuardAbilityResultSchema.parse(buildGeometryResultPayload(input, buildGeometryResultRefs(input)));
}
