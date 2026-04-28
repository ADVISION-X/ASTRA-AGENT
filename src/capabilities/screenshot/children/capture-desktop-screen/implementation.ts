import path from "node:path";

import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotChildCapability } from "../../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../../contract.js";
import { buildIdentityScaleMapping, captureDesktopScreenArtifact, createFileHash, createScreenshotEvidenceId, ensureCapabilityOutputDir, readImageDimensions } from "../../shared/image-artifact-support.js";

export function createCaptureDesktopScreenCapability(): ScreenshotChildCapability {
  return {
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: "capture-desktop-screen",
    async execute(input: ScreenshotAbilityInput, context): Promise<ScreenshotAbilityResult> {
      const startedAt = Date.now();
      const evidenceId = createScreenshotEvidenceId("capture-desktop-screen");
      const outputDir = await ensureCapabilityOutputDir(context.outputRootDir, "capture-desktop-screen");
      const storageRef = path.join(outputDir, `${evidenceId}.png`);
      await captureDesktopScreenArtifact(storageRef);
      const dimensions = await readImageDimensions(storageRef);
      const outputHash = await createFileHash(storageRef);
      return {
        status: "success",
        abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
        childCapabilityId: "capture-desktop-screen",
        evidenceId,
        storageRef,
        pageUrl: null,
        pageTitle: null,
        width: dimensions.width,
        height: dimensions.height,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        imageKind: "evidence_original",
        coordinateSpace: "desktop_screen_pixels",
        scaleMapping: buildIdentityScaleMapping({
          sourceScreenshotEvidenceId: null,
          sourceStorageRef: storageRef,
          sourceCoordinateSpace: "desktop_screen_pixels",
        }),
        sourceScreenshotEvidenceId: null,
        screenId: input.source.kind === "desktop_screen" ? input.source.screenId ?? "primary" : "primary",
        sourceHash: outputHash,
        outputHash,
        failureReason: null,
        dataQualityFlags: ["video_screenshot_ok", "desktop_screen_capture"],
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        browserCapture: null,
      };
    },
  };
}