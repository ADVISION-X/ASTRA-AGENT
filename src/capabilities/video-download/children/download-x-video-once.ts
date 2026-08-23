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

type ParsedDownloadXVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-x-video-once" }
>;

// Phase 1 stub: delegates to universal extractor.
// X/Twitter __NEXT_DATA__ specific extraction will replace this in a future phase.
async function executeDownloadXVideoOnce(
  input: ParsedDownloadXVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  try {
    const webInput = { ...input, childCapabilityId: "download-web-video-once" as const };
    const result = await downloadWebVideoOnce.execute(webInput, context);
    return {
      ...result,
      childCapabilityId: "download-x-video-once",
      runtimeProof: {
        ...result.runtimeProof,
        childCapabilityId: "download-x-video-once",
        platformId: "x-web",
      },
      output: { ...result.output, platformId: "x-web" },
    } as VideoDownloadResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown X/Twitter download failure.";
    return buildVideoDownloadFailure(base, "network_failed", msg);
  }
}

export const downloadXVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-x-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadXVideoOnce(input as ParsedDownloadXVideoInput, context),
};
