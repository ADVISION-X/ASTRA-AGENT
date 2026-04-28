import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotChildCapability } from "../../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../../contract.js";
import { buildIdentityScaleMapping, createFileHash, createScreenshotEvidenceId } from "../../shared/image-artifact-support.js";

export function createCaptureBrowserViewportCapability(): ScreenshotChildCapability {
  return {
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: "capture-browser-viewport",
    async execute(input: ScreenshotAbilityInput, context): Promise<ScreenshotAbilityResult> {
      const startedAt = Date.now();
      const capture = await context.browserController.screenshotRegion({
        regionLabel: input.purpose,
        contentLines: input.contentLines,
      });
      const geometry = await context.browserController.getGeometrySnapshot();
      if (!capture.sourceFilePath) {
        return {
          status: "failed",
          abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
          childCapabilityId: "capture-browser-viewport",
          evidenceId: null,
          storageRef: null,
          pageUrl: capture.pageUrl,
          pageTitle: capture.pageTitle,
          width: null,
          height: null,
          originalWidth: null,
          originalHeight: null,
          imageKind: null,
          coordinateSpace: null,
          scaleMapping: null,
          sourceScreenshotEvidenceId: null,
          screenId: null,
          sourceHash: null,
          outputHash: null,
          failureReason: "browser screenshot returned no source file path",
          dataQualityFlags: ["video_screenshot_missing"],
          createdAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          browserCapture: capture,
        };
      }

      const outputHash = await createFileHash(capture.sourceFilePath);
      return {
        status: "success",
        abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
        childCapabilityId: "capture-browser-viewport",
        evidenceId: createScreenshotEvidenceId("capture-browser-viewport"),
        storageRef: capture.sourceFilePath,
        pageUrl: capture.pageUrl,
        pageTitle: capture.pageTitle,
        width: capture.width,
        height: capture.height,
        originalWidth: capture.width,
        originalHeight: capture.height,
        imageKind: "evidence_original",
        coordinateSpace: "browser_viewport_pixels",
        scaleMapping: buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: null,
          sourceStorageRef: capture.sourceFilePath,
          sourceCoordinateSpace: "browser_viewport_pixels",
        }),
        sourceScreenshotEvidenceId: null,
        screenId: null,
        sourceHash: outputHash,
        outputHash,
        failureReason: null,
        dataQualityFlags: ["video_screenshot_ok", `viewport:${geometry.viewportWidth}x${geometry.viewportHeight}`],
        createdAt: capture.createdAt,
        durationMs: Date.now() - startedAt,
        browserCapture: capture,
      };
    },
  };
}