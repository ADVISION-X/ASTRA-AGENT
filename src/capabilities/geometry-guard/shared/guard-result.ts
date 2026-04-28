import {
  GEOMETRY_GUARD_ABILITY_GROUP_ID,
  type GeometryGuardAbilityInput,
  type GeometryGuardAbilityResult,
  type GeometryGuardBoundingBox,
  type GeometryGuardDecision,
  type GeometryGuardExecutionSpace,
  type GeometryGuardFailureReason,
  type GeometryGuardPoint,
  type GeometryGuardScaleMapping,
} from "../contract.js";
import { createId } from "../../../lib/local-runtime/ids.js";
import { buildGeometryGuardRuntimeProof } from "./runtime-proof.js";

function buildResult(input: {
  callInput: GeometryGuardAbilityInput;
  startedAt: string;
  endedAt: string;
  status: GeometryGuardAbilityResult["status"];
  guardDecision: GeometryGuardDecision;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
  failureReason: GeometryGuardFailureReason | null;
  statusMessage: string;
}): GeometryGuardAbilityResult {
  const geometryGuardRef = createId("geometry_guard");
  const result = {
    status: input.status,
    abilityGroupId: GEOMETRY_GUARD_ABILITY_GROUP_ID,
    childCapabilityId: input.callInput.childCapabilityId,
    sessionId: input.callInput.sessionId,
    roundId: input.callInput.roundId,
    videoVisitId: input.callInput.videoVisitId,
    geometryGuardRef,
    guardDecision: input.guardDecision,
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    normalizedClickPoint: input.normalizedClickPoint,
    normalizedBbox: input.normalizedBbox,
    appliedScaleMapping: input.appliedScaleMapping,
    sourceScreenshotEvidenceRef: input.callInput.sourceScreenshotEvidenceRef,
    sourceTargetRef: input.callInput.sourceTargetRef,
    sourceAiResultRef: input.callInput.sourceAiResultRef,
    failureReason: input.failureReason,
    debugLogRef: input.callInput.sourceScreenshotEvidenceRef ?? input.callInput.sourceTargetRef ?? input.callInput.sourceAiResultRef,
    runtimeProof: buildGeometryGuardRuntimeProof({
      callInput: input.callInput,
      geometryGuardRef,
      result: {
        guardDecision: input.guardDecision,
        normalizedCoordinateSpace: input.normalizedCoordinateSpace,
      },
    }),
    dataQualityFlags: [...input.callInput.dataQualityFlags],
    statusMessage: input.statusMessage,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
  } satisfies GeometryGuardAbilityResult;

  return result;
}

export function buildGeometryGuardFailure(input: {
  callInput: GeometryGuardAbilityInput;
  startedAt: string;
  endedAt: string;
  failureReason: GeometryGuardFailureReason;
  statusMessage: string;
}): GeometryGuardAbilityResult {
  return buildResult({
    callInput: input.callInput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    status: "failed",
    guardDecision: "block",
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    appliedScaleMapping: null,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
  });
}

export function buildGeometryGuardReviewRequired(input: {
  callInput: GeometryGuardAbilityInput;
  startedAt: string;
  endedAt: string;
  failureReason: GeometryGuardFailureReason;
  statusMessage: string;
}): GeometryGuardAbilityResult {
  return buildResult({
    callInput: input.callInput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    status: "review_required",
    guardDecision: "review_required",
    normalizedCoordinateSpace: null,
    normalizedClickPoint: null,
    normalizedBbox: null,
    appliedScaleMapping: null,
    failureReason: input.failureReason,
    statusMessage: input.statusMessage,
  });
}

export function buildGeometryGuardSuccess(input: {
  callInput: GeometryGuardAbilityInput;
  startedAt: string;
  endedAt: string;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace;
  normalizedClickPoint: GeometryGuardPoint;
  normalizedBbox: GeometryGuardBoundingBox;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
  statusMessage: string;
}): GeometryGuardAbilityResult {
  return buildResult({
    callInput: input.callInput,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    status: "success",
    guardDecision: "allow",
    normalizedCoordinateSpace: input.normalizedCoordinateSpace,
    normalizedClickPoint: input.normalizedClickPoint,
    normalizedBbox: input.normalizedBbox,
    appliedScaleMapping: input.appliedScaleMapping,
    failureReason: null,
    statusMessage: input.statusMessage,
  });
}