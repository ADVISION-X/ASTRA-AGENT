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
import { evaluateCoordinateSpace } from "./coordinate-space-gate.js";
import { resolveGeometrySourceEvidenceDecision } from "./geometry-input-gate.js";
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

type GeometryResultRefs = {
  geometryGuardRef: string;
  outputRef: string | null;
  diagnosticPayloadRef: string | null;
};

type GeometryDecisionState = {
  sourceEvidenceDecision: GeometryGuardCheckDecision;
  coordinateSpaceDecision: GeometryGuardCheckDecision;
  executionSpaceDecision: GeometryGuardCheckDecision;
  outputBoundaryDecision: GeometryGuardCheckDecision;
  allowSuccess: boolean;
};

function isAllowSuccess(input: BuildGeometryGuardResultInput): boolean {
  return input.status === "success" && input.guardDecision === "allow";
}

function buildGeometryResultRefs(input: BuildGeometryGuardResultInput) {
  const allowSuccess = isAllowSuccess(input);
  const geometryGuardRef = buildStableGeometryRef([
    "geometry-guard",
    input.request.childCapabilityId,
    input.request.missionId ?? input.request.sessionId,
    input.request.runId ?? input.request.roundId,
    input.request.stepId ?? input.request.videoVisitId,
    input.request.capabilityCallId,
    input.request.sourceRef ?? input.request.sourceTargetRef,
  ]);

  return {
    geometryGuardRef,
    outputRef: allowSuccess ? buildStableGeometryRef([geometryGuardRef, "output", input.request.idempotencyKey]) : null,
    diagnosticPayloadRef: allowSuccess
      ? null
      : buildStableGeometryRef([
          geometryGuardRef,
          "diagnostic",
          input.status,
          input.guardDecision,
          input.failureReason ?? input.reviewRequiredReason ?? "none",
        ]),
  };
}

function resolveExecutionSpaceDecision(input: BuildGeometryGuardResultInput, executableOutput: boolean): GeometryGuardCheckDecision {
  if (!executableOutput) {
    return "not_applicable";
  }
  if (isAllowSuccess(input) && input.normalizedCoordinateSpace !== null) {
    return "passed";
  }
  return input.status === "review_required" ? "review_required" : "failed";
}

function hasExecutableSuccessPayload(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs, executableOutput: boolean): boolean {
  return input.output !== null
    && refs.outputRef !== null
    && input.normalizedCoordinateSpace !== null
    && (!executableOutput || input.normalizedClickPoint !== null);
}

function hasFailureBoundaryPayload(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs): boolean {
  return input.output === null && refs.outputRef === null && refs.diagnosticPayloadRef !== null;
}

function resolveOutputBoundaryDecision(
  input: BuildGeometryGuardResultInput,
  refs: GeometryResultRefs,
  executableOutput: boolean,
): GeometryGuardCheckDecision {
  if (isAllowSuccess(input)) {
    return hasExecutableSuccessPayload(input, refs, executableOutput) ? "passed" : "failed";
  }

  return hasFailureBoundaryPayload(input, refs) ? "passed" : "failed";
}

function resolveGeometryDecisionState(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs): GeometryDecisionState {
  const coordinateGate = evaluateCoordinateSpace(input.request);
  const sourceEvidenceDecision = resolveGeometrySourceEvidenceDecision(input.request);
  const executionSpaceDecision = resolveExecutionSpaceDecision(input, coordinateGate.childRoute.executableOutput);
  const outputBoundaryDecision = resolveOutputBoundaryDecision(input, refs, coordinateGate.childRoute.executableOutput);

  return {
    sourceEvidenceDecision,
    coordinateSpaceDecision: coordinateGate.coordinateDecision,
    executionSpaceDecision,
    outputBoundaryDecision,
    allowSuccess: isAllowSuccess(input),
  };
}

function buildGeometryProofPayload(
  input: BuildGeometryGuardResultInput,
  refs: GeometryResultRefs,
  decisionState: GeometryDecisionState,
) {
  return {
    request: input.request,
    geometryGuardRef: refs.geometryGuardRef,
    outputRef: refs.outputRef,
    diagnosticPayloadRef: refs.diagnosticPayloadRef,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    normalizedBbox: input.normalizedBbox,
    normalizedClickPoint: input.normalizedClickPoint,
    sourceBounds: input.sourceBounds,
    targetBounds: input.targetBounds,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    status: input.status,
    guardDecision: input.guardDecision,
    sourceEvidenceDecision: decisionState.sourceEvidenceDecision,
    coordinateSpaceDecision: decisionState.coordinateSpaceDecision,
    executionSpaceDecision: decisionState.executionSpaceDecision,
    outputBoundaryDecision: decisionState.outputBoundaryDecision,
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

function buildGeometryCoreIdentityPayload(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs) {
  return {
    status: input.status,
    abilityGroupId: "geometry-guard",
    childCapabilityId: input.request.childCapabilityId,
    geometryGuardRef: refs.geometryGuardRef,
    guardDecision: input.guardDecision,
    nerveBusEnvelopeId: input.request.nerveBusEnvelopeId,
  };
}

function buildGeometryCoreMissionPayload(input: BuildGeometryGuardResultInput) {
  return {
    missionId: input.request.missionId,
    runId: input.request.runId,
    sessionId: input.request.sessionId,
    roundId: input.request.roundId,
    videoVisitId: input.request.videoVisitId,
    stepId: input.request.stepId,
  };
}

function buildGeometryCoreMapPayload(input: BuildGeometryGuardResultInput) {
  return {
    mapPackageId: input.request.mapPackageId,
    mapPackageVersion: input.request.mapPackageVersion,
    selectedMapId: input.request.selectedMapId,
    selectedMapVersion: input.request.selectedMapVersion,
    activationSnapshotRef: input.request.activationSnapshotRef,
    capabilityCallId: input.request.capabilityCallId,
  };
}

function buildGeometryCoreOutputPayload(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs, decisionState: GeometryDecisionState) {
  return {
    output: decisionState.allowSuccess ? input.output : null,
    outputRef: refs.outputRef,
    diagnosticPayloadRef: refs.diagnosticPayloadRef,
    normalizedCoordinateSpace: decisionState.allowSuccess ? input.normalizedCoordinateSpace : null,
    normalizedClickPoint: decisionState.allowSuccess ? input.normalizedClickPoint : null,
    normalizedBbox: decisionState.allowSuccess ? input.normalizedBbox : null,
    appliedScaleMapping: decisionState.allowSuccess ? input.appliedScaleMapping : null,
    sourceScreenshotEvidenceRef: input.request.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.request.sourceTargetRef,
    sourceAiResultRef: input.request.sourceAiResultRef,
    sourcePageStateProofRef: input.request.sourcePageStateProofRef,
    sourceVisualTargetResultRef: input.request.sourceVisualTargetResultRef,
    debugLogRef: refs.diagnosticPayloadRef ?? refs.outputRef,
  };
}

function buildGeometryCoreDecisionPayload(input: BuildGeometryGuardResultInput, decisionState: GeometryDecisionState) {
  return {
    sourceEvidenceDecision: decisionState.sourceEvidenceDecision,
    coordinateSpaceDecision: decisionState.coordinateSpaceDecision,
    executionSpaceDecision: decisionState.executionSpaceDecision,
    outputBoundaryDecision: decisionState.outputBoundaryDecision,
  };
}

function buildGeometryCoreRiskPayload(input: BuildGeometryGuardResultInput) {
  return {
    riskLevel: input.request.riskLevel,
    requiresPostClickAiVerification: input.request.requiresPostClickAiVerification,
    fallbackReason: input.request.fallbackReason,
    targetSemanticOwner: input.request.targetSemanticOwner,
    actionableMessage: input.request.actionableMessage,
  };
}

function buildGeometryCorePayload(
  input: BuildGeometryGuardResultInput,
  refs: GeometryResultRefs,
  decisionState: GeometryDecisionState,
) {
  return {
    ...buildGeometryCoreIdentityPayload(input, refs),
    ...buildGeometryCoreMissionPayload(input),
    ...buildGeometryCoreMapPayload(input),
    ...buildGeometryCoreOutputPayload(input, refs, decisionState),
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    ...buildGeometryCoreDecisionPayload(input, decisionState),
    ...buildGeometryCoreRiskPayload(input),
  };
}

function buildGeometryResultPayload(input: BuildGeometryGuardResultInput, refs: GeometryResultRefs) {
  const decisionState = resolveGeometryDecisionState(input, refs);
  return {
    ...buildGeometryCorePayload(input, refs, decisionState),
    runtimeProof: buildGeometryRuntimeProof(buildGeometryProofPayload(input, refs, decisionState)),
    ...buildGeometryAuditPayload(input),
  };
}

export function buildGeometryGuardResult(input: BuildGeometryGuardResultInput): GeometryGuardAbilityResult {
  return GeometryGuardAbilityResultSchema.parse(buildGeometryResultPayload(input, buildGeometryResultRefs(input)));
}
