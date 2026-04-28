import type {
  GeometryGuardAbilityInput,
  GeometryGuardBoundingBox,
  GeometryGuardFailureReason,
  GeometryGuardPoint,
  GeometryGuardScaleMapping,
} from "../contract.js";
import {
  isBoundingBoxWithinSize,
  isPointInsideBoundingBox,
  isPointWithinSize,
  isValidBoundingBox,
  isValidPoint,
  isValidSize,
} from "./bounds-utils.js";
import { isContactSheetSpace, isExecutionSpace, requiresScaleMapping } from "./coordinate-space.js";
import { isValidScaleMapping } from "./scale-mapping.js";

type ValidationFailure = {
  decision: "block" | "review_required";
  failureReason: GeometryGuardFailureReason;
  statusMessage: string;
};

export function validateBaseInput(input: GeometryGuardAbilityInput): ValidationFailure | null {
  if (!input.requestedBy.trim()) {
    return { decision: "block", failureReason: "missing_requested_by", statusMessage: "geometry guard requires requestedBy" };
  }

  if (!input.purpose.trim()) {
    return { decision: "block", failureReason: "missing_purpose", statusMessage: "geometry guard requires purpose" };
  }

  if (!input.sourceCoordinateSpace) {
    return { decision: "block", failureReason: "missing_coordinate_space", statusMessage: "geometry guard requires sourceCoordinateSpace" };
  }

  if (!input.requestedExecutionSpace) {
    return { decision: "block", failureReason: "execution_space_missing", statusMessage: "geometry guard requires requestedExecutionSpace" };
  }

  if (input.safetyPolicy.requireSourceRef && !input.sourceScreenshotEvidenceRef && !input.sourceTargetRef && !input.sourceAiResultRef) {
    return { decision: "block", failureReason: "missing_source_ref", statusMessage: "geometry guard requires at least one source ref" };
  }

  if (isContactSheetSpace(input.sourceCoordinateSpace)) {
    return {
      decision: input.safetyPolicy.allowReviewRequired ? "review_required" : "block",
      failureReason: "contact_sheet_coordinate_not_executable",
      statusMessage: "contactSheet coordinates are evidence only and cannot execute directly",
    };
  }

  if (input.requestedExecutionSpace === "desktopScreen" && input.deviceScaleFactor === null) {
    return {
      decision: "block",
      failureReason: "device_scale_factor_missing",
      statusMessage: "desktopScreen execution requires deviceScaleFactor",
    };
  }

  return null;
}

export function validateBoundingBox(input: GeometryGuardAbilityInput): ValidationFailure | null {
  if (!input.bbox) {
    return { decision: "block", failureReason: "missing_bbox", statusMessage: "geometry guard requires bbox" };
  }

  if (!isValidBoundingBox(input.bbox)) {
    return { decision: "block", failureReason: "invalid_bbox", statusMessage: "geometry guard bbox must be finite and positive" };
  }

  return null;
}

export function validateClickPoint(input: GeometryGuardAbilityInput, bbox: GeometryGuardBoundingBox): ValidationFailure | null {
  if (!input.clickPoint) {
    return { decision: "block", failureReason: "missing_click_point", statusMessage: "geometry guard requires clickPoint" };
  }

  if (!isValidPoint(input.clickPoint)) {
    return { decision: "block", failureReason: "invalid_click_point", statusMessage: "geometry guard clickPoint must be finite" };
  }

  if (!isPointInsideBoundingBox(input.clickPoint, bbox)) {
    return {
      decision: "block",
      failureReason: "click_point_outside_bbox",
      statusMessage: "geometry guard clickPoint must stay inside bbox",
    };
  }

  return null;
}

export function validateScaleMappingRequirement(input: GeometryGuardAbilityInput): ValidationFailure | null {
  if (isExecutionSpace(input.sourceCoordinateSpace)) {
    return null;
  }

  if (!requiresScaleMapping(input.sourceCoordinateSpace)) {
    return {
      decision: input.safetyPolicy.allowReviewRequired ? "review_required" : "block",
      failureReason: "geometry_review_required",
      statusMessage: `geometry guard cannot normalize ${input.sourceCoordinateSpace}`,
    };
  }

  if (!input.scaleMapping) {
    if (input.sourceCoordinateSpace === "aiInput") {
      return {
        decision: input.safetyPolicy.allowReviewRequired ? "review_required" : "block",
        failureReason: "ai_input_mapping_required",
        statusMessage: "aiInput coordinates require scaleMapping into executable space",
      };
    }

    if (input.sourceCoordinateSpace === "regionCrop") {
      return {
        decision: input.safetyPolicy.allowReviewRequired ? "review_required" : "block",
        failureReason: "region_mapping_required",
        statusMessage: "regionCrop coordinates require scaleMapping into executable space",
      };
    }

    return {
      decision: "block",
      failureReason: "missing_scale_mapping",
      statusMessage: "imageEvidence coordinates require scaleMapping into executable space",
    };
  }

  if (!isValidScaleMapping(input.scaleMapping) || input.scaleMapping.targetCoordinateSpace !== input.requestedExecutionSpace) {
    return {
      decision: "block",
      failureReason: "invalid_scale_mapping",
      statusMessage: "geometry guard scaleMapping must target the requested executable space",
    };
  }

  return null;
}

export function validateExecutionBounds(input: {
  bbox: GeometryGuardBoundingBox;
  clickPoint: GeometryGuardPoint;
  requestedExecutionSpace: GeometryGuardAbilityInput["requestedExecutionSpace"];
  viewportSize: GeometryGuardAbilityInput["viewportSize"];
  screenSize: GeometryGuardAbilityInput["screenSize"];
}): ValidationFailure | null {
  const executionBounds = input.requestedExecutionSpace === "browserViewport" ? input.viewportSize : input.screenSize;
  if (!isValidSize(executionBounds)) {
    return {
      decision: "block",
      failureReason: "execution_space_missing",
      statusMessage: `${input.requestedExecutionSpace} bounds are required for geometry guard`,
    };
  }

  if (!isBoundingBoxWithinSize(input.bbox, executionBounds) || !isPointWithinSize(input.clickPoint, executionBounds)) {
    return {
      decision: "block",
      failureReason: "bbox_out_of_bounds",
      statusMessage: `geometry guard blocked ${input.requestedExecutionSpace} coordinates outside execution bounds`,
    };
  }

  return null;
}

export function resolveFailure(input: ValidationFailure): ValidationFailure {
  return input;
}

export function asValidatedBoundingBox(bbox: GeometryGuardBoundingBox | null): GeometryGuardBoundingBox {
  if (!bbox || !isValidBoundingBox(bbox)) {
    throw new Error("geometry guard bbox was expected to be validated before use");
  }
  return bbox;
}

export function asValidatedClickPoint(clickPoint: GeometryGuardPoint | null): GeometryGuardPoint {
  if (!clickPoint || !isValidPoint(clickPoint)) {
    throw new Error("geometry guard clickPoint was expected to be validated before use");
  }
  return clickPoint;
}

export function asValidatedScaleMapping(scaleMapping: GeometryGuardScaleMapping | null): GeometryGuardScaleMapping {
  if (!scaleMapping || !isValidScaleMapping(scaleMapping)) {
    throw new Error("geometry guard scaleMapping was expected to be validated before use");
  }
  return scaleMapping;
}