import type {
  GeometryGuardAbilityContext,
  GeometryGuardAbilityResult,
  GeometryGuardResultOutput,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { evaluateBounds } from "./bounds-gate.js";
import { evaluateClickSafety } from "./click-safety-gate.js";
import { evaluateCoordinateSpace } from "./coordinate-space-gate.js";
import { dispatchGeometryGuardFailure } from "./geometry-dispatch-failure.js";
import { evaluateGeometryInputPolicy } from "./geometry-input-gate.js";
import { buildGeometryGuardResult } from "./geometry-result-builder.js";
import { evaluateScaleMapping } from "./scale-mapping-gate.js";
import { transformGeometry } from "./geometry-transformer.js";

function buildChildOutput(input: {
  request: ParsedGeometryGuardAbilityInput;
  sourceBounds: Parameters<typeof buildGeometryGuardResult>[0]["sourceBounds"];
  targetBounds: Parameters<typeof buildGeometryGuardResult>[0]["targetBounds"];
  appliedScaleMapping: Parameters<typeof buildGeometryGuardResult>[0]["appliedScaleMapping"];
  normalizedCoordinateSpace: Parameters<typeof buildGeometryGuardResult>[0]["normalizedCoordinateSpace"];
  normalizedClickPoint: Parameters<typeof buildGeometryGuardResult>[0]["normalizedClickPoint"];
  normalizedBbox: Parameters<typeof buildGeometryGuardResult>[0]["normalizedBbox"];
}): GeometryGuardResultOutput | null {
  switch (input.request.childCapabilityId) {
    case "validate-coordinate-space":
      return { kind: "validate-coordinate-space", coordinateSpaceAccepted: true };
    case "validate-bbox-integrity":
      return input.sourceBounds ? { kind: "validate-bbox-integrity", bboxAccepted: true, sourceBounds: input.sourceBounds } : null;
    case "validate-click-point":
      return {
        kind: "validate-click-point",
        clickPointAccepted: true,
        clickSafetyMarginPx: input.request.safetyPolicy.clickSafetyMarginPx,
      };
    case "validate-scale-mapping":
      return input.sourceBounds && input.targetBounds && input.appliedScaleMapping
        ? {
            kind: "validate-scale-mapping",
            scaleMappingAccepted: true,
            sourceBounds: input.sourceBounds,
            targetBounds: input.targetBounds,
            appliedScaleMapping: input.appliedScaleMapping,
          }
        : null;
    case "map-ai-input-to-viewport":
      return input.normalizedCoordinateSpace && input.normalizedClickPoint && input.normalizedBbox
        ? {
            kind: "map-ai-input-to-viewport",
            mappedToExecutionSpace: true,
            normalizedCoordinateSpace: input.normalizedCoordinateSpace,
            normalizedClickPoint: input.normalizedClickPoint,
            normalizedBbox: input.normalizedBbox,
            appliedScaleMapping: input.appliedScaleMapping,
          }
        : null;
    case "map-region-to-source":
      return input.normalizedCoordinateSpace && input.normalizedClickPoint && input.normalizedBbox
        ? {
            kind: "map-region-to-source",
            mappedToExecutionSpace: true,
            normalizedCoordinateSpace: input.normalizedCoordinateSpace,
            normalizedClickPoint: input.normalizedClickPoint,
            normalizedBbox: input.normalizedBbox,
            appliedScaleMapping: input.appliedScaleMapping,
          }
        : null;
    case "validate-browser-viewport-bounds":
      return input.normalizedCoordinateSpace === "browserViewport" && input.normalizedClickPoint && input.normalizedBbox
        ? {
            kind: "validate-browser-viewport-bounds",
            boundsAccepted: true,
            normalizedCoordinateSpace: "browserViewport",
            normalizedClickPoint: input.normalizedClickPoint,
            normalizedBbox: input.normalizedBbox,
            appliedScaleMapping: input.appliedScaleMapping,
          }
        : null;
    case "validate-desktop-screen-bounds":
      return input.normalizedCoordinateSpace === "desktopScreen" && input.normalizedClickPoint && input.normalizedBbox
        ? {
            kind: "validate-desktop-screen-bounds",
            boundsAccepted: true,
            normalizedCoordinateSpace: "desktopScreen",
            normalizedClickPoint: input.normalizedClickPoint,
            normalizedBbox: input.normalizedBbox,
            appliedScaleMapping: input.appliedScaleMapping,
          }
        : null;
  }
}

export async function executeGeometryGuardChild(input: {
  request: ParsedGeometryGuardAbilityInput;
  context: GeometryGuardAbilityContext;
}): Promise<GeometryGuardAbilityResult> {
  const started = input.context.clock.now();

  try {
    const policyFailure = evaluateGeometryInputPolicy(input.request);
    if (policyFailure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: policyFailure.status,
        guardDecision: policyFailure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: null,
        failureReason: policyFailure.failureReason,
        reviewRequiredReason: policyFailure.reviewRequiredReason,
        statusMessage: policyFailure.message,
        policyDecision: policyFailure.policyDecision,
        boundsDecision: policyFailure.boundsDecision,
        scaleDecision: policyFailure.scaleDecision,
        transformDecision: policyFailure.transformDecision,
        sourceBounds: null,
        targetBounds: null,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...policyFailure.dataQualityFlags],
      });
    }

    const coordinateGate = evaluateCoordinateSpace(input.request);
    if (coordinateGate.failure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: coordinateGate.failure.status,
        guardDecision: coordinateGate.failure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: null,
        failureReason: coordinateGate.failure.failureReason,
        reviewRequiredReason: coordinateGate.failure.reviewRequiredReason,
        statusMessage: coordinateGate.failure.message,
        policyDecision: coordinateGate.failure.policyDecision,
        boundsDecision: coordinateGate.failure.boundsDecision,
        scaleDecision: coordinateGate.failure.scaleDecision,
        transformDecision: coordinateGate.failure.transformDecision,
        sourceBounds: null,
        targetBounds: null,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...coordinateGate.failure.dataQualityFlags],
      });
    }

    const boundsGate = evaluateBounds(input.request, {
      requireBBox: input.request.childCapabilityId !== "validate-scale-mapping" && input.request.childCapabilityId !== "validate-coordinate-space",
      requireClickPoint: coordinateGate.childRoute.executableOutput || input.request.childCapabilityId === "validate-click-point",
      requireSourceBounds: coordinateGate.childRoute.requiresScaleMapping || input.request.childCapabilityId === "validate-bbox-integrity",
      requireTargetBounds: coordinateGate.childRoute.executableOutput || input.request.childCapabilityId === "validate-scale-mapping",
    });
    if (boundsGate.failure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: boundsGate.failure.status,
        guardDecision: boundsGate.failure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: null,
        failureReason: boundsGate.failure.failureReason,
        reviewRequiredReason: boundsGate.failure.reviewRequiredReason,
        statusMessage: boundsGate.failure.message,
        policyDecision: coordinateGate.coordinateDecision,
        boundsDecision: boundsGate.failure.boundsDecision,
        scaleDecision: boundsGate.failure.scaleDecision,
        transformDecision: boundsGate.failure.transformDecision,
        sourceBounds: boundsGate.sourceBounds,
        targetBounds: boundsGate.targetBounds,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...boundsGate.failure.dataQualityFlags],
      });
    }

    const scaleGate = evaluateScaleMapping(
      input.request,
      coordinateGate.childRoute.requiresScaleMapping || input.request.childCapabilityId === "validate-scale-mapping",
    );
    if (scaleGate.failure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: scaleGate.failure.status,
        guardDecision: scaleGate.failure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: null,
        failureReason: scaleGate.failure.failureReason,
        reviewRequiredReason: scaleGate.failure.reviewRequiredReason,
        statusMessage: scaleGate.failure.message,
        policyDecision: coordinateGate.coordinateDecision,
        boundsDecision: boundsGate.boundsDecision,
        scaleDecision: scaleGate.failure.scaleDecision,
        transformDecision: scaleGate.failure.transformDecision,
        sourceBounds: boundsGate.sourceBounds,
        targetBounds: boundsGate.targetBounds,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...scaleGate.failure.dataQualityFlags],
      });
    }

    const clickSafety = evaluateClickSafety(
      input.request,
      boundsGate.bbox,
      boundsGate.clickPoint,
      coordinateGate.childRoute.executableOutput,
    );
    if (clickSafety.failure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: clickSafety.failure.status,
        guardDecision: clickSafety.failure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: scaleGate.scaleMapping,
        failureReason: clickSafety.failure.failureReason,
        reviewRequiredReason: clickSafety.failure.reviewRequiredReason,
        statusMessage: clickSafety.failure.message,
        policyDecision: coordinateGate.coordinateDecision,
        boundsDecision: clickSafety.failure.boundsDecision,
        scaleDecision: scaleGate.scaleDecision,
        transformDecision: clickSafety.failure.transformDecision,
        sourceBounds: boundsGate.sourceBounds,
        targetBounds: boundsGate.targetBounds,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...clickSafety.failure.dataQualityFlags],
      });
    }

    const transform = transformGeometry({
      request: input.request,
      bbox: boundsGate.bbox,
      clickPoint: boundsGate.clickPoint,
      targetBounds: boundsGate.targetBounds,
      scaleMapping: scaleGate.scaleMapping,
      requiresExecutableOutput: coordinateGate.childRoute.executableOutput,
    });
    if (transform.failure) {
      const ended = input.context.clock.now();
      return buildGeometryGuardResult({
        request: input.request,
        status: transform.failure.status,
        guardDecision: transform.failure.guardDecision,
        output: null,
        normalizedCoordinateSpace: null,
        normalizedClickPoint: null,
        normalizedBbox: null,
        appliedScaleMapping: scaleGate.scaleMapping,
        failureReason: transform.failure.failureReason,
        reviewRequiredReason: transform.failure.reviewRequiredReason,
        statusMessage: transform.failure.message,
        policyDecision: coordinateGate.coordinateDecision,
        boundsDecision: clickSafety.boundsDecision === "not_applicable" ? boundsGate.boundsDecision : clickSafety.boundsDecision,
        scaleDecision: scaleGate.scaleDecision,
        transformDecision: transform.failure.transformDecision,
        sourceBounds: boundsGate.sourceBounds,
        targetBounds: boundsGate.targetBounds,
        startedAt: started.iso,
        endedAt: ended.iso,
        durationMs: Math.max(0, ended.epochMs - started.epochMs),
        dataQualityFlags: [...input.request.dataQualityFlags, ...transform.failure.dataQualityFlags],
      });
    }

    const ended = input.context.clock.now();
    const output = buildChildOutput({
      request: input.request,
      sourceBounds: boundsGate.sourceBounds,
      targetBounds: boundsGate.targetBounds,
      appliedScaleMapping: transform.appliedScaleMapping,
      normalizedCoordinateSpace: transform.normalizedCoordinateSpace,
      normalizedClickPoint: transform.normalizedClickPoint,
      normalizedBbox: transform.normalizedBbox,
    });
    return buildGeometryGuardResult({
      request: input.request,
      status: "success",
      guardDecision: coordinateGate.childRoute.executableOutput ? "allow" : "review_required",
      output,
      normalizedCoordinateSpace: transform.normalizedCoordinateSpace,
      normalizedClickPoint: transform.normalizedClickPoint,
      normalizedBbox: transform.normalizedBbox,
      appliedScaleMapping: transform.appliedScaleMapping,
      failureReason: null,
      reviewRequiredReason: coordinateGate.childRoute.executableOutput ? null : "geometry_review_required",
      statusMessage: coordinateGate.childRoute.executableOutput
        ? `Geometry Guard approved ${input.request.childCapabilityId}.`
        : `Geometry Guard validated ${input.request.childCapabilityId} without issuing executable coordinates.`,
      policyDecision: coordinateGate.coordinateDecision,
      boundsDecision: clickSafety.boundsDecision === "not_applicable" ? boundsGate.boundsDecision : clickSafety.boundsDecision,
      scaleDecision: scaleGate.scaleDecision,
      transformDecision: transform.transformDecision,
      sourceBounds: boundsGate.sourceBounds,
      targetBounds: boundsGate.targetBounds,
      startedAt: started.iso,
      endedAt: ended.iso,
      durationMs: Math.max(0, ended.epochMs - started.epochMs),
      dataQualityFlags: [...input.request.dataQualityFlags],
    });
  } catch (error) {
    return dispatchGeometryGuardFailure({
      input: input.request,
      context: input.context,
      failureReason: "runtime_exception",
      status: "failed",
      statusMessage: error instanceof Error ? error.message : String(error),
      dataQualityFlags: [...input.request.dataQualityFlags, "runtime_exception"],
    });
  }
}
