import path from "node:path";

import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotChildCapability } from "../../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../../contract.js";
import { buildIdentityScaleMapping, createFileHash, createScreenshotEvidenceId, ensureCapabilityOutputDir, optimizeLosslessPng, readImageDimensions } from "../../shared/image-artifact-support.js";

export function createOptimizeLosslessCapability(): ScreenshotChildCapability {
  return {
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: "optimize-lossless",
    async execute(input: ScreenshotAbilityInput, context): Promise<ScreenshotAbilityResult> {
      const startedAt = Date.now();
      if (input.source.kind !== "stored_image") {
        return {
          status: "review_required",
          abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
          childCapabilityId: "optimize-lossless",
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
          sourceScreenshotEvidenceId: null,
          screenId: null,
          sourceHash: null,
          outputHash: null,
          failureReason: "optimize-lossless requires a persisted source image.",
          dataQualityFlags: ["review_required"],
          createdAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          browserCapture: null,
        };
      }

      const evidenceId = createScreenshotEvidenceId("optimize-lossless");
      const outputDir = await ensureCapabilityOutputDir(context.outputRootDir, "optimize-lossless");
      const storageRef = path.join(outputDir, `${evidenceId}.png`);
      const sourceDimensions = await readImageDimensions(input.source.storageRef);
      await optimizeLosslessPng({ sourceFilePath: input.source.storageRef, outputPath: storageRef });
      const optimizedDimensions = await readImageDimensions(storageRef);
      const sourceHash = await createFileHash(input.source.storageRef);
      const outputHash = await createFileHash(storageRef);
      return {
        status: "success",
        abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
        childCapabilityId: "optimize-lossless",
        evidenceId,
        storageRef,
        pageUrl: null,
        pageTitle: null,
        width: optimizedDimensions.width,
        height: optimizedDimensions.height,
        originalWidth: sourceDimensions.width,
        originalHeight: sourceDimensions.height,
        imageKind: "evidence_optimized",
        coordinateSpace: input.source.coordinateSpace ?? "source_image_pixels",
        scaleMapping: buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: input.source.sourceScreenshotEvidenceId ?? null,
          sourceStorageRef: input.source.storageRef,
          sourceCoordinateSpace: input.source.coordinateSpace ?? "source_image_pixels",
        }),
        sourceScreenshotEvidenceId: input.source.sourceScreenshotEvidenceId ?? null,
        screenId: null,
        sourceHash,
        outputHash,
        failureReason: null,
        dataQualityFlags: ["video_screenshot_ok", "lossless_optimized"],
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        browserCapture: null,
      };
    },
  };
}