import type {
  VideoDownloadAbilityGroup,
  VideoDownloadExecutionContext,
} from "./contract.js";
import {
  VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  VideoDownloadAbilityInputSchema,
  type ParsedDownloadFacebookVideoInput,
  type VideoDownloadAbilityInput,
  type VideoDownloadChildCapabilityId,
  type VideoDownloadResult,
} from "./schema.js";
import {
  createVideoDownloadCapabilityRegistry,
  listVideoDownloadChildren,
} from "./registry.js";
import { buildVideoDownloadFailure } from "./runtime/result.js";

const resolveFallbackInput = (input: VideoDownloadAbilityInput): ParsedDownloadFacebookVideoInput => ({
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: "download-facebook-video-once" as const,
  missionId: typeof input.missionId === "string" ? input.missionId : "unknown",
  runId: typeof input.runId === "string" ? input.runId : "unknown",
  capabilityCallId: typeof input.capabilityCallId === "string" ? input.capabilityCallId : "unknown",
  sourcePageUrl: typeof input.sourcePageUrl === "string" ? input.sourcePageUrl : "https://www.facebook.com/",
  preferredQuality: "best_available" as const,
  maxBytes: 100_000_000,
  timeoutMs: 30_000,
});

const inputParseFailure = (input: VideoDownloadAbilityInput): VideoDownloadResult =>
  buildVideoDownloadFailure(
    { input: resolveFallbackInput(input), startedAt: new Date().toISOString() },
    "input_schema_invalid",
    "Video download input schema is invalid.",
    "invalid_input",
  );

export const createVideoDownloadAbilityGroup = (
  context: VideoDownloadExecutionContext,
): VideoDownloadAbilityGroup => {
  const registry = createVideoDownloadCapabilityRegistry();
  return {
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    listChildCapabilityIds(): VideoDownloadChildCapabilityId[] {
      return listVideoDownloadChildren();
    },
    async execute(input: VideoDownloadAbilityInput): Promise<VideoDownloadResult> {
      const parsed = VideoDownloadAbilityInputSchema.safeParse(input);
      if (!parsed.success) return inputParseFailure(input);
      const child = registry.get(parsed.data.childCapabilityId);
      if (!child) {
        return buildVideoDownloadFailure(
          { input: parsed.data, startedAt: new Date().toISOString() },
          "unknown_child_capability",
          "Video download child capability is not registered.",
        );
      }
      return child.execute(parsed.data, context);
    },
  };
};
