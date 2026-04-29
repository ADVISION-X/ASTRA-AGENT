import type {
  GeometryGuardAbilityResult,
  GeometryGuardBoundingBox,
  GeometryGuardResultOutput,
  GeometryGuardRuntimeProof,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GeometryGuardRuntimeProofSchema } from "../schema.js";
import { buildStableGeometryRef } from "../shared/geometry-transform.js";

export function buildGeometryRuntimeProof(input: {
  request: ParsedGeometryGuardAbilityInput;
  geometryGuardRef: string;
  outputRef: string | null;
  output: GeometryGuardResultOutput | null;
  normalizedCoordinateSpace: GeometryGuardAbilityResult["normalizedCoordinateSpace"];
  normalizedBbox: GeometryGuardAbilityResult["normalizedBbox"];
  normalizedClickPoint: GeometryGuardAbilityResult["normalizedClickPoint"];
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
  failureReason: GeometryGuardAbilityResult["failureReason"];
  reviewRequiredReason: GeometryGuardAbilityResult["reviewRequiredReason"];
  status: GeometryGuardAbilityResult["status"];
  guardDecision: GeometryGuardAbilityResult["guardDecision"];
  policyDecision: GeometryGuardAbilityResult["policyDecision"];
  boundsDecision: GeometryGuardAbilityResult["boundsDecision"];
  scaleDecision: GeometryGuardAbilityResult["scaleDecision"];
  transformDecision: GeometryGuardAbilityResult["transformDecision"];
  startedAt: string;
  endedAt: string;
  durationMs: number;
  dataQualityFlags: string[];
}): GeometryGuardRuntimeProof {
  return GeometryGuardRuntimeProofSchema.parse({
    proofId: buildStableGeometryRef([input.geometryGuardRef, "proof"]),
    runId: buildStableGeometryRef([input.request.sessionId, input.request.childCapabilityId, input.request.roundId, input.request.videoVisitId]),
    missionId: input.request.sessionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    abilityGroupId: "geometry-guard",
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId ?? input.request.requestedBy,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.request.inputRef ?? input.request.sourceTargetRef ?? input.request.sourceScreenshotEvidenceRef ?? input.request.sourceAiResultRef,
    outputRef: input.outputRef,
    sourceScreenshotEvidenceRef: input.request.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.request.sourceTargetRef,
    sourceAiResultRef: input.request.sourceAiResultRef,
    sourceCoordinateSpace: input.request.sourceCoordinateSpace,
    requestedExecutionSpace: input.request.requestedExecutionSpace,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
    bboxBefore: input.request.bbox ?? null,
    bboxAfter: input.normalizedBbox,
    clickPointBefore: input.request.clickPoint ?? null,
    clickPointAfter: input.normalizedClickPoint,
    scaleMappingRef: input.request.scaleMapping?.scaleMappingRef ?? null,
    deviceScaleFactor: input.request.deviceScaleFactor ?? null,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    status: input.status,
    guardDecision: input.guardDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    policyDecision: input.policyDecision,
    boundsDecision: input.boundsDecision,
    scaleDecision: input.scaleDecision,
    transformDecision: input.transformDecision,
    dataQualityFlags: input.dataQualityFlags,
  });
}
