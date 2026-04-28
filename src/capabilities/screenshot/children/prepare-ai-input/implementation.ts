import path from "node:path";

import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotChildCapability } from "../../contract.js";
import { DEFAULT_AI_INPUT_MAX_WIDTH, SCREENSHOT_ABILITY_GROUP_ID } from "../../contract.js";
import { buildDerivedScaleMapping, createFileHash, createScreenshotEvidenceId, ensureCapabilityOutputDir, prepareAiInputImage, readImageDimensions } from "../../shared/image-artifact-support.js";

export function createPrepareAiInputCapability(): ScreenshotChildCapability {
  return {
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: "prepare-ai-input",
    async execute(input: ScreenshotAbilityInput, context): Promise<ScreenshotAbilityResult> {
      const startedAt = Date.now();
      if (input.source.kind !== "stored_image") {
        return {
          status: "review_required",
          abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
          childCapabilityId: "prepare-ai-input",
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
          failureReason: "prepare-ai-input requires a persisted source image.",
          dataQualityFlags: ["review_required"],
          createdAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          browserCapture: null,
        };
      }

      const evidenceId = createScreenshotEvidenceId("prepare-ai-input");
      const outputDir = await ensureCapabilityOutputDir(context.outputRootDir, "prepare-ai-input");
      const storageRef = path.join(outputDir, `${evidenceId}.jpg`);
      const sourceDimensions = await readImageDimensions(input.source.storageRef);
      const prepared = await prepareAiInputImage({
        sourceFilePath: input.source.storageRef,
        outputPath: storageRef,
        maxDimension: input.maxAiWidth ?? context.defaultAiMaxWidth ?? DEFAULT_AI_INPUT_MAX_WIDTH,
        region: input.region,
      });
      const sourceHash = await createFileHash(input.source.storageRef);
      const outputHash = await createFileHash(storageRef);
      return {
        status: "success",
        abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
        childCapabilityId: "prepare-ai-input",
        evidenceId,
        storageRef,
        pageUrl: null,
        pageTitle: null,
        width: prepared.outputWidth,
        height: prepared.outputHeight,
        originalWidth: sourceDimensions.width,
        originalHeight: sourceDimensions.height,
        imageKind: "ai_input",
        coordinateSpace: "ai_input_pixels",
        scaleMapping: buildDerivedScaleMapping({
          sourceScreenshotEvidenceId: input.region?.sourceScreenshotEvidenceId ?? input.source.sourceScreenshotEvidenceId ?? null,
          sourceStorageRef: input.source.storageRef,
          sourceCoordinateSpace: input.region?.coordinateSpace ?? input.source.coordinateSpace ?? "source_image_pixels",
          cropOffsetX: prepared.cropOffsetX,
          cropOffsetY: prepared.cropOffsetY,
          sourceWidth: prepared.sourceWidth,
          sourceHeight: prepared.sourceHeight,
          outputWidth: prepared.outputWidth,
          outputHeight: prepared.outputHeight,
        }),
        sourceScreenshotEvidenceId: input.region?.sourceScreenshotEvidenceId ?? input.source.sourceScreenshotEvidenceId ?? null,
        screenId: null,
        sourceHash,
        outputHash,
        failureReason: null,
        dataQualityFlags: ["local_ai_ok", "ai_input_ready"],
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        browserCapture: null,
      };
    },
  };
}