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

type ParsedDownloadBilibiliVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-bilibili-video-once" }
>;

// Phase 1 stub: delegates to universal extractor.
// Bilibili-specific page data extraction will replace this in a future phase.
async function executeDownloadBilibiliVideoOnce(
  input: ParsedDownloadBilibiliVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  try {
    const webInput = { ...input, childCapabilityId: "download-web-video-once" as const };
    const result = await downloadWebVideoOnce.execute(webInput, context);
    return {
      ...result,
      childCapabilityId: "download-bilibili-video-once",
      runtimeProof: {
        ...result.runtimeProof,
        childCapabilityId: "download-bilibili-video-once",
        platformId: "bilibili-web",
      },
      output: { ...result.output, platformId: "bilibili-web" },
    } as VideoDownloadResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Bilibili download failure.";
    return buildVideoDownloadFailure(base, "network_failed", msg);
  }
}

export const downloadBilibiliVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-bilibili-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadBilibiliVideoOnce(input as ParsedDownloadBilibiliVideoInput, context),
};
