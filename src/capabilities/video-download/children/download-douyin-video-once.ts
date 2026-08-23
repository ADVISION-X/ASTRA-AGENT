// Douyin shares the same page data structure as TikTok.
import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadResult,
} from "../schema.js";
import { downloadTikTokVideoOnce } from "./download-tiktok-video-once.js";
import {
  buildVideoDownloadFailure,
} from "../runtime/result.js";

type ParsedDownloadDouyinVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-douyin-video-once" }
>;

async function executeDownloadDouyinVideoOnce(
  input: ParsedDownloadDouyinVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  // Re-use TikTok engine: Douyin page data structure is the same family.
  const base = { input, startedAt: new Date().toISOString() };
  try {
    // Delegate to TikTok child by temporarily re-labeling for execution
    const tiktokInput = { ...input, childCapabilityId: "download-tiktok-video-once" as const };
    const result = await downloadTikTokVideoOnce.execute(tiktokInput, context);
    // Re-stamp with douyin childCapabilityId in the result proof
    return {
      ...result,
      childCapabilityId: "download-douyin-video-once",
      runtimeProof: {
        ...result.runtimeProof,
        childCapabilityId: "download-douyin-video-once",
        platformId: "douyin-web",
      },
      output: {
        ...result.output,
        platformId: "douyin-web",
      },
    } as VideoDownloadResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown Douyin download failure.";
    return buildVideoDownloadFailure(base, "network_failed", msg);
  }
}

export const downloadDouyinVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-douyin-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadDouyinVideoOnce(input as ParsedDownloadDouyinVideoInput, context),
};
