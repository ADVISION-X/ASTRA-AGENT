import type { ScreenshotRuntimeProof, ScreenshotScaleMapping } from "../contract.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";

type TransformScaleMappingInput = {
  operation: "capture-region" | "optimize-lossless" | "prepare-ai-input";
  sourceProof: {
    sourceScreenshotEvidenceId: string | null;
    sourceStorageRef: string | null;
    coordinateSpace: ScreenshotScaleMapping["sourceCoordinateSpace"];
    sourceWidth: number | null;
    sourceHeight: number | null;
  };
  imageOutput: {
    sourceWidth: number | null;
    sourceHeight: number | null;
    width: number;
    height: number;
    cropOffsetX: number;
    cropOffsetY: number;
  } | null;
  captureSize: { width: number; height: number } | null;
  region: { x: number; y: number } | null;
};

function resolveStoredSourceDimensions(input: TransformScaleMappingInput) {
  return {
    sourceWidth: input.sourceProof.sourceWidth ?? input.imageOutput?.sourceWidth ?? input.captureSize?.width ?? 0,
    sourceHeight: input.sourceProof.sourceHeight ?? input.imageOutput?.sourceHeight ?? input.captureSize?.height ?? 0,
  };
}

function resolveTransformedTargetDimensions(input: TransformScaleMappingInput) {
  return {
    targetWidth: input.imageOutput?.width ?? input.captureSize?.width ?? 0,
    targetHeight: input.imageOutput?.height ?? input.captureSize?.height ?? 0,
  };
}

function resolveDerivedTransformScaleMapping(input: TransformScaleMappingInput, targetCoordinateSpace: ScreenshotRuntimeProof["coordinateSpace"]): ScreenshotScaleMapping {
  return buildDerivedScaleMapping({
    sourceScreenshotEvidenceId: input.sourceProof.sourceScreenshotEvidenceId,
    sourceStorageRef: input.sourceProof.sourceStorageRef,
    sourceCoordinateSpace: input.sourceProof.coordinateSpace ?? "source_image_pixels",
    targetCoordinateSpace,
    ...resolveStoredSourceDimensions(input),
    ...resolveTransformedTargetDimensions(input),
    cropOffsetX: input.imageOutput?.cropOffsetX ?? input.region?.x ?? 0,
    cropOffsetY: input.imageOutput?.cropOffsetY ?? input.region?.y ?? 0,
  });
}

export function resolveTransformScaleMapping(input: TransformScaleMappingInput): ScreenshotScaleMapping {
  switch (input.operation) {
    case "capture-region":
      return resolveDerivedTransformScaleMapping(input, "region_crop_pixels");
    case "prepare-ai-input":
      return resolveDerivedTransformScaleMapping(input, "ai_input_pixels");
    case "optimize-lossless":
      return buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: input.sourceProof.sourceScreenshotEvidenceId,
        sourceStorageRef: input.sourceProof.sourceStorageRef,
        sourceCoordinateSpace: input.sourceProof.coordinateSpace ?? "source_image_pixels",
        ...resolveStoredSourceDimensions(input),
      });
  }
}

export function resolveTransformCoordinateSpace(input: {
  operation: TransformScaleMappingInput["operation"];
  sourceCoordinateSpace: ScreenshotScaleMapping["sourceCoordinateSpace"];
}): ScreenshotRuntimeProof["coordinateSpace"] {
  switch (input.operation) {
    case "capture-region":
      return "region_crop_pixels";
    case "optimize-lossless":
      return input.sourceCoordinateSpace ?? "source_image_pixels";
    case "prepare-ai-input":
      return "ai_input_pixels";
  }
}