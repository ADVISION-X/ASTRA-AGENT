import path from "node:path";

import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotChildCapability } from "../../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../../contract.js";
import { buildDerivedScaleMapping, createFileHash, createScreenshotEvidenceId, cropImageRegion, ensureCapabilityOutputDir, readImageDimensions } from "../../shared/image-artifact-support.js";

export function createCaptureRegionCapability(): ScreenshotChildCapability {
  return {
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: "capture-region",
    async execute(input: ScreenshotAbilityInput, context): Promise<ScreenshotAbilityResult> {
      const startedAt = Date.now();
      if (input.source.kind !== "stored_image" || !input.region) {
        return {
          status: "review_required",
          abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
          childCapabilityId: "capture-region",
          evidenceId: null,
          storageRef: null,
          pageUrl: null,
          pageTitle: null,
          width: null,
          height: null,
          originalWidth: null,
          originalHeight: null,
          imageKind: null,
          coordinateSpace: null,
          scaleMapping: null,
          sourceScreenshotEvidenceId: input.region?.sourceScreenshotEvidenceId ?? null,
          screenId: null,
          sourceHash: null,
          outputHash: null,
          failureReason: "capture-region requires a validated bbox with sourceScreenshotEvidenceId and sourceStorageRef.",
          dataQualityFlags: ["review_required"],
          createdAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          browserCapture: null,
        };
      }

      const evidenceId = createScreenshotEvidenceId("capture-region");
      const outputDir = await ensureCapabilityOutputDir(context.outputRootDir, "capture-region");
      const storageRef = path.join(outputDir, `${evidenceId}.png`);
      const sourceDimensions = await readImageDimensions(input.source.storageRef);
      const outputDimensions = await cropImageRegion({
        sourceFilePath: input.source.storageRef,
        box: input.region,
        outputPath: storageRef,
      });
      const sourceHash = await createFileHash(input.source.storageRef);
      const outputHash = await createFileHash(storageRef);
      return {
        status: "success",
        abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
        childCapabilityId: "capture-region",
        evidenceId,
        storageRef,
        pageUrl: null,
        pageTitle: null,
        width: outputDimensions.width,
        height: outputDimensions.height,
        originalWidth: sourceDimensions.width,
        originalHeight: sourceDimensions.height,
        imageKind: "evidence_original",
        coordinateSpace: "source_image_pixels",
        scaleMapping: buildDerivedScaleMapping({
          sourceScreenshotEvidenceId: input.region.sourceScreenshotEvidenceId,
          sourceStorageRef: input.source.storageRef,
          sourceCoordinateSpace: input.region.coordinateSpace,
          cropOffsetX: input.region.x,
          cropOffsetY: input.region.y,
          sourceWidth: input.region.width,
          sourceHeight: input.region.height,
          outputWidth: outputDimensions.width,
          outputHeight: outputDimensions.height,
        }),
        sourceScreenshotEvidenceId: input.region.sourceScreenshotEvidenceId,
        screenId: null,
        sourceHash,
        outputHash,
        failureReason: null,
        dataQualityFlags: ["video_screenshot_ok", "region_capture_ok"],
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        browserCapture: null,
      };
    },
  };
}