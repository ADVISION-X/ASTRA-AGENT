import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadResult,
} from "../schema.js";
import { downloadWebVideoOnce } from "./download-web-video-once.js";
import { buildVideoDownloadFailure } from "../runtime/result.js";

type ParsedDownloadInstagramVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-instagram-video-once" }
>;

// Phase 1 stub: delegates to universal extractor.
// Instagram-specific Shared Data extraction will replace this in a future phase.
async function executeDownloadInstagramVideoOnce(
  input: ParsedDownloadInstagramVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  try {
    const webInput = { ...input, childCapabilityId: "download-web-video-once" as const };
    const result = await downloadWebVideoOnce.execute(webInput, context);
    return {
      ...result,
      childCapabilityId: "download-instagram-video-once",
      runtimeProof: {
        ...result.runtimeProof,
        childCapabilityId: "download-instagram-video-once",
        platformId: "instagram-web",
      },
      output: { ...result.output, platformId: "instagram-web" },
    } as VideoDownloadResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Instagram download failure.";
    return buildVideoDownloadFailure(base, "network_failed", msg);
  }
}

export const downloadInstagramVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-instagram-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadInstagramVideoOnce(input as ParsedDownloadInstagramVideoInput, context),
};
