import { evaluateBounds } from "./bounds-gate.js";
import { evaluateClickSafety } from "./click-safety-gate.js";
import { evaluateCoordinateSpace } from "./coordinate-space-gate.js";
import type {
  GeometryExecutionInput,
  GeometryStageResult,
  GeometryValidationState,
} from "./geometry-execution-types.js";
import { evaluateGeometryInputPolicy } from "./geometry-input-gate.js";
import { evaluateScaleMapping } from "./scale-mapping-gate.js";
import { buildGeometryStageFailureResult } from "./geometry-stage-failure.js";

const runPolicyStage = (input: GeometryExecutionInput) => {
  const policyFailure = evaluateGeometryInputPolicy(input.request);
  return policyFailure
    ? buildGeometryStageFailureResult(input, {
        status: policyFailure.status,
        guardDecision: policyFailure.guardDecision,
        failureReason: policyFailure.failureReason,
        reviewRequiredReason: policyFailure.reviewRequiredReason,
        statusMessage: policyFailure.message,
        policyDecision: policyFailure.policyDecision,
        boundsDecision: policyFailure.boundsDecision,
        scaleDecision: policyFailure.scaleDecision,
        transformDecision: policyFailure.transformDecision,
        sourceBounds: null,
        targetBounds: null,
        appliedScaleMapping: null,
        dataQualityFlags: [...input.request.dataQualityFlags, ...policyFailure.dataQualityFlags],
      })
    : null;
};

const runCoordinateStage = (input: GeometryExecutionInput) => {
  const coordinateGate = evaluateCoordinateSpace(input.request);
  return coordinateGate.failure
    ? {
        ok: false,
        result: buildGeometryStageFailureResult(input, {
          status: coordinateGate.failure.status,
          guardDecision: coordinateGate.failure.guardDecision,
          failureReason: coordinateGate.failure.failureReason,
          reviewRequiredReason: coordinateGate.failure.reviewRequiredReason,
          statusMessage: coordinateGate.failure.message,
          policyDecision: coordinateGate.failure.policyDecision,
          boundsDecision: coordinateGate.failure.boundsDecision,
          scaleDecision: coordinateGate.failure.scaleDecision,
          transformDecision: coordinateGate.failure.transformDecision,
          sourceBounds: null,
          targetBounds: null,
          appliedScaleMapping: null,
          dataQualityFlags: [...input.request.dataQualityFlags, ...coordinateGate.failure.dataQualityFlags],
        }),
      }
    : { ok: true, state: coordinateGate };
};

const runBoundsStage = (
  input: GeometryExecutionInput,
  coordinateGate: ReturnType<typeof evaluateCoordinateSpace>,
) => {
  const boundsGate = evaluateBounds(input.request, {
    requireBBox: input.request.childCapabilityId !== "validate-scale-mapping" && input.request.childCapabilityId !== "validate-coordinate-space",
    requireClickPoint: coordinateGate.childRoute.executableOutput || input.request.childCapabilityId === "validate-click-point",
    requireSourceBounds: coordinateGate.childRoute.requiresScaleMapping || input.request.childCapabilityId === "validate-bbox-integrity",
    requireTargetBounds: coordinateGate.childRoute.executableOutput || input.request.childCapabilityId === "validate-scale-mapping",
  });
  return boundsGate.failure
    ? {
        ok: false,
        result: buildGeometryStageFailureResult(input, {
          status: boundsGate.failure.status,
          guardDecision: boundsGate.failure.guardDecision,
          failureReason: boundsGate.failure.failureReason,
          reviewRequiredReason: boundsGate.failure.reviewRequiredReason,
          statusMessage: boundsGate.failure.message,
          policyDecision: coordinateGate.coordinateDecision,
          boundsDecision: boundsGate.failure.boundsDecision,
          scaleDecision: boundsGate.failure.scaleDecision,
          transformDecision: boundsGate.failure.transformDecision,
          sourceBounds: boundsGate.sourceBounds,
          targetBounds: boundsGate.targetBounds,
          appliedScaleMapping: null,
          dataQualityFlags: [...input.request.dataQualityFlags, ...boundsGate.failure.dataQualityFlags],
        }),
      }
    : { ok: true, state: boundsGate };
};

const runScaleStage = (
  input: GeometryExecutionInput,
  coordinateGate: ReturnType<typeof evaluateCoordinateSpace>,
  boundsGate: ReturnType<typeof evaluateBounds>,
) => {
  const scaleGate = evaluateScaleMapping(
    input.request,
    coordinateGate.childRoute.requiresScaleMapping || input.request.childCapabilityId === "validate-scale-mapping",
  );
  return scaleGate.failure
    ? {
        ok: false,
        result: buildGeometryStageFailureResult(input, {
          status: scaleGate.failure.status,
          guardDecision: scaleGate.failure.guardDecision,
          failureReason: scaleGate.failure.failureReason,
          reviewRequiredReason: scaleGate.failure.reviewRequiredReason,
          statusMessage: scaleGate.failure.message,
          policyDecision: coordinateGate.coordinateDecision,
          boundsDecision: boundsGate.boundsDecision,
          scaleDecision: scaleGate.failure.scaleDecision,
          transformDecision: scaleGate.failure.transformDecision,
          sourceBounds: boundsGate.sourceBounds,
          targetBounds: boundsGate.targetBounds,
          appliedScaleMapping: null,
          dataQualityFlags: [...input.request.dataQualityFlags, ...scaleGate.failure.dataQualityFlags],
        }),
      }
    : { ok: true, state: scaleGate };
};

const runClickSafetyStage = (
  input: GeometryExecutionInput,
  coordinateGate: ReturnType<typeof evaluateCoordinateSpace>,
  boundsGate: ReturnType<typeof evaluateBounds>,
  scaleGate: ReturnType<typeof evaluateScaleMapping>,
) => {
  const clickSafety = evaluateClickSafety(
    input.request,
    boundsGate.bbox,
    boundsGate.clickPoint,
    coordinateGate.childRoute.executableOutput,
  );
  return clickSafety.failure
    ? {
        ok: false,
        result: buildGeometryStageFailureResult(input, {
          status: clickSafety.failure.status,
          guardDecision: clickSafety.failure.guardDecision,
          failureReason: clickSafety.failure.failureReason,
          reviewRequiredReason: clickSafety.failure.reviewRequiredReason,
          statusMessage: clickSafety.failure.message,
          policyDecision: coordinateGate.coordinateDecision,
          boundsDecision: clickSafety.failure.boundsDecision,
          scaleDecision: scaleGate.scaleDecision,
          transformDecision: clickSafety.failure.transformDecision,
          sourceBounds: boundsGate.sourceBounds,
          targetBounds: boundsGate.targetBounds,
          appliedScaleMapping: scaleGate.scaleMapping,
          dataQualityFlags: [...input.request.dataQualityFlags, ...clickSafety.failure.dataQualityFlags],
        }),
      }
    : { ok: true, state: clickSafety };
};

export const runGeometryInputStages = (
  input: GeometryExecutionInput,
): GeometryStageResult<GeometryValidationState> => {
  const policyResult = runPolicyStage(input);
  if (policyResult) {
    return { ok: false, result: policyResult };
  }

  const coordinateStage = runCoordinateStage(input);
  if (!coordinateStage.ok) {
    return coordinateStage;
  }

  const boundsStage = runBoundsStage(input, coordinateStage.state);
  if (!boundsStage.ok) {
    return boundsStage;
  }

  const scaleStage = runScaleStage(input, coordinateStage.state, boundsStage.state);
  if (!scaleStage.ok) {
    return scaleStage;
  }

  const clickSafetyStage = runClickSafetyStage(input, coordinateStage.state, boundsStage.state, scaleStage.state);
  return clickSafetyStage.ok
    ? {
        ok: true,
        state: {
          coordinateGate: coordinateStage.state,
          boundsGate: boundsStage.state,
          scaleGate: scaleStage.state,
          clickSafety: clickSafetyStage.state,
        },
      }
    : clickSafetyStage;
};