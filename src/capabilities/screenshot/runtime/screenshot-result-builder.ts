import { ScreenshotExecutionOutputSchema, ScreenshotResultSchema } from "../schema.js";
import type { ScreenshotAbilityInput, ScreenshotAbilityResult, ScreenshotArtifactRef, ScreenshotRuntimeProof, ScreenshotScaleMapping, ScreenshotStatus } from "../contract.js";
import { SCREENSHOT_ABILITY_GROUP_ID } from "../shared/screenshot-types.js";

export function buildScreenshotSuccessOutput(input: {
  request: ScreenshotAbilityInput;
  artifactRef: ScreenshotArtifactRef;
  evidenceId: string;
  pageUrl: string | null;
  pageTitle: string | null;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  imageKind: "evidence_original" | "evidence_optimized" | "ai_input";
  coordinateSpace: "browser_viewport_pixels" | "desktop_screen_pixels" | "source_image_pixels" | "ai_input_pixels";
  scaleMapping: ScreenshotScaleMapping | null;
  sourceScreenshotEvidenceId: string | null;
  screenId: string | null;
  sourceHash: string;
  outputHash: string;
  regionLabel: string;
  regionType: string;
}): ReturnType<typeof ScreenshotExecutionOutputSchema.parse> {
  return ScreenshotExecutionOutputSchema.parse({
    artifactRef: input.artifactRef,
    evidenceId: input.evidenceId,
    pageUrl: input.pageUrl,
    pageTitle: input.pageTitle,
    width: input.width,
    height: input.height,
    originalWidth: input.originalWidth,
    originalHeight: input.originalHeight,
    imageKind: input.imageKind,
    coordinateSpace: input.coordinateSpace,
    scaleMapping: input.scaleMapping,
    sourceScreenshotEvidenceId: input.sourceScreenshotEvidenceId,
    screenId: input.screenId,
    sourceHash: input.sourceHash,
    outputHash: input.outputHash,
    regionLabel: input.regionLabel,
    regionType: input.regionType,
    contentLines: input.request.contentLines,
  });
}

export function buildScreenshotResult(input: {
  request: ScreenshotAbilityInput;
  status: ScreenshotStatus;
  message: string;
  output: ReturnType<typeof ScreenshotExecutionOutputSchema.parse> | null;
  failureReason: ScreenshotAbilityResult["failureReason"];
  reviewRequiredReason: string | null;
  runtimeProof: ScreenshotRuntimeProof;
}): ScreenshotAbilityResult {
  return ScreenshotResultSchema.parse({
    abilityGroupId: SCREENSHOT_ABILITY_GROUP_ID,
    childCapabilityId: input.request.childCapabilityId,
    status: input.status,
    message: input.message,
    output: input.output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof: input.runtimeProof,
  });
}
