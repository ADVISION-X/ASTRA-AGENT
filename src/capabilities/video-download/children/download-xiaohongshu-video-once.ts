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

type ParsedDownloadXiaohongshuVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-xiaohongshu-video-once" }
>;

// Phase 1 stub: delegates to universal extractor.
// 小红书/RED specific page data extraction will replace this in a future phase.
async function executeDownloadXiaohongshuVideoOnce(
  input: ParsedDownloadXiaohongshuVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  try {
    const webInput = { ...input, childCapabilityId: "download-web-video-once" as const };
    const result = await downloadWebVideoOnce.execute(webInput, context);
    return {
      ...result,
      childCapabilityId: "download-xiaohongshu-video-once",
      runtimeProof: {
        ...result.runtimeProof,
        childCapabilityId: "download-xiaohongshu-video-once",
        platformId: "xiaohongshu-web",
      },
      output: { ...result.output, platformId: "xiaohongshu-web" },
    } as VideoDownloadResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown 小红书 download failure.";
    return buildVideoDownloadFailure(base, "network_failed", msg);
  }
}

export const downloadXiaohongshuVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-xiaohongshu-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadXiaohongshuVideoOnce(input as ParsedDownloadXiaohongshuVideoInput, context),
};
