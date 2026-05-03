import type {
  GeometryGuardAbilityResult,
  GeometryGuardBoundingBox,
  GeometryGuardRuntimeProof,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { GeometryGuardRuntimeProofSchema } from "../schema.js";
import { buildStableGeometryRef } from "../shared/geometry-transform.js";

function buildGeometryProofChainFields(input: Parameters<typeof buildGeometryRuntimeProof>[0]) {
  return {
    runId: input.request.runId,
    missionId: input.request.missionId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    stepId: input.request.stepId,
    mapPackageId: input.request.mapPackageId,
    mapPackageVersion: input.request.mapPackageVersion,
    selectedMapId: input.request.selectedMapId,
    selectedMapVersion: input.request.selectedMapVersion,
    activationSnapshotRef: input.request.activationSnapshotRef,
    capabilityCallId: input.request.capabilityCallId,
    nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
  };
}

function buildGeometryProofSourceFields(input: Parameters<typeof buildGeometryRuntimeProof>[0]) {
  return {
    abilityGroupId: "geometry-guard" as const,
    childCapabilityId: input.request.childCapabilityId,
    sourceAbilityGroupId: input.request.sourceAbilityGroupId,
    sourceChildCapabilityId: input.request.sourceChildCapabilityId,
    inputRef: input.request.inputRef,
    sourceRef: input.request.sourceRef,
    outputRef: input.outputRef,
    diagnosticPayloadRef: input.diagnosticPayloadRef,
    sourceScreenshotEvidenceRef: input.request.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.request.sourceTargetRef,
    sourceAiResultRef: input.request.sourceAiResultRef,
    sourcePageStateProofRef: input.request.sourcePageStateProofRef,
    sourceVisualTargetResultRef: input.request.sourceVisualTargetResultRef,
    sourceGeometryHandoffRef: input.request.sourceGeometryHandoffRef,
  };
}

function buildGeometryProofGeometryFields(input: Parameters<typeof buildGeometryRuntimeProof>[0]) {
  return {
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
  };
}

function buildGeometryProofDecisionFields(input: Parameters<typeof buildGeometryRuntimeProof>[0]) {
  return {
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: input.durationMs,
    idempotencyKey: input.request.idempotencyKey,
    status: input.status,
    guardDecision: input.guardDecision,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    sourceEvidenceDecision: input.sourceEvidenceDecision,
    coordinateSpaceDecision: input.coordinateSpaceDecision,
    executionSpaceDecision: input.executionSpaceDecision,
    outputBoundaryDecision: input.outputBoundaryDecision,
    policyDecision: input.policyDecision,
    boundsDecision: input.boundsDecision,
    scaleDecision: input.scaleDecision,
    transformDecision: input.transformDecision,
    dataQualityFlags: input.dataQualityFlags,
  };
}

export function buildGeometryRuntimeProof(input: {
  request: ParsedGeometryGuardAbilityInput;
  geometryGuardRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
  normalizedCoordinateSpace: GeometryGuardAbilityResult["normalizedCoordinateSpace"];
  normalizedBbox: GeometryGuardAbilityResult["normalizedBbox"];
  normalizedClickPoint: GeometryGuardAbilityResult["normalizedClickPoint"];
  sourceBounds: GeometryGuardBoundingBox | null;
  targetBounds: GeometryGuardBoundingBox | null;
  failureReason: GeometryGuardAbilityResult["failureReason"];
  reviewRequiredReason: GeometryGuardAbilityResult["reviewRequiredReason"];
  status: GeometryGuardAbilityResult["status"];
  guardDecision: GeometryGuardAbilityResult["guardDecision"];
  sourceEvidenceDecision: GeometryGuardAbilityResult["sourceEvidenceDecision"];
  coordinateSpaceDecision: GeometryGuardAbilityResult["coordinateSpaceDecision"];
  executionSpaceDecision: GeometryGuardAbilityResult["executionSpaceDecision"];
  outputBoundaryDecision: GeometryGuardAbilityResult["outputBoundaryDecision"];
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
    ...buildGeometryProofChainFields(input),
    ...buildGeometryProofSourceFields(input),
    ...buildGeometryProofGeometryFields(input),
    ...buildGeometryProofDecisionFields(input),
  });
}
