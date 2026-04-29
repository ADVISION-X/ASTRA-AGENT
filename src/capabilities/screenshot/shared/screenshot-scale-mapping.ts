import type { ScreenshotCoordinateSpace, ScreenshotScaleMapping } from "../contract.js";

export function buildIdentityScaleMapping(input: {
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  sourceCoordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
  sourceWidth: number;
  sourceHeight: number;
}): ScreenshotScaleMapping {
  return {
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    sourceStorageRef: input.sourceStorageRef,
    sourceCoordinateSpace: input.sourceCoordinateSpace,
    targetCoordinateSpace: input.sourceCoordinateSpace,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    targetWidth: input.sourceWidth,
    targetHeight: input.sourceHeight,
    cropOffsetX: 0,
    cropOffsetY: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

export function buildDerivedScaleMapping(input: {
  sourceScreenshotEvidenceId: string | null;
  sourceStorageRef: string | null;
  sourceCoordinateSpace: Exclude<ScreenshotCoordinateSpace, "ai_input_pixels">;
  targetCoordinateSpace: ScreenshotCoordinateSpace;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  cropOffsetX: number;
  cropOffsetY: number;
}): ScreenshotScaleMapping {
  return {
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    sourceStorageRef: input.sourceStorageRef,
    sourceCoordinateSpace: input.sourceCoordinateSpace,
    targetCoordinateSpace: input.targetCoordinateSpace,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight,
    cropOffsetX: input.cropOffsetX,
    cropOffsetY: input.cropOffsetY,
    scaleX: input.targetWidth / input.sourceWidth,
    scaleY: input.targetHeight / input.sourceHeight,
  };
}
