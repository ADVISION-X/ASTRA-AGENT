import type { ScreenshotRuntimeProof, ScreenshotScaleMapping } from "../contract.js";
import { buildDerivedScaleMapping, buildIdentityScaleMapping } from "../shared/screenshot-scale-mapping.js";

type BrowserViewportCapture = {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

function hasBrowserCaptureScaleGap(capture: BrowserViewportCapture): boolean {
  return capture.viewportWidth !== capture.width || capture.viewportHeight !== capture.height;
}

export function resolveBrowserCaptureScaleMapping(input: {
  capture: BrowserViewportCapture;
  sourceStorageRef: string | null;
}): ScreenshotScaleMapping {
  return hasBrowserCaptureScaleGap(input.capture)
    ? buildDerivedScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: input.sourceStorageRef,
        sourceCoordinateSpace: "browser_viewport_pixels",
        targetCoordinateSpace: "source_image_pixels",
        sourceWidth: input.capture.viewportWidth,
        sourceHeight: input.capture.viewportHeight,
        targetWidth: input.capture.width,
        targetHeight: input.capture.height,
        cropOffsetX: 0,
        cropOffsetY: 0,
      })
    : buildIdentityScaleMapping({
        sourceScreenshotEvidenceId: null,
        sourceStorageRef: input.sourceStorageRef,
        sourceCoordinateSpace: "browser_viewport_pixels",
        sourceWidth: input.capture.width,
        sourceHeight: input.capture.height,
      });
}

export function resolveBrowserCaptureCoordinateSpace(
  capture: BrowserViewportCapture,
): ScreenshotRuntimeProof["coordinateSpace"] {
  return hasBrowserCaptureScaleGap(capture) ? "source_image_pixels" : "browser_viewport_pixels";
}