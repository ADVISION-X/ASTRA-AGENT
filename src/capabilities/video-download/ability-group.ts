import type {
  VideoDownloadAbilityGroup,
  VideoDownloadExecutionContext,
} from "./contract.js";
import {
  VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  VideoDownloadAbilityInputSchema,
  type ParsedVideoDownloadAbilityInput,
  type VideoDownloadAbilityInput,
  type VideoDownloadChildCapabilityId,
  type VideoDownloadResult,
} from "./schema.js";
import {
  createVideoDownloadCapabilityRegistry,
  listVideoDownloadChildren,
} from "./registry.js";
import { buildVideoDownloadFailure } from "./runtime/result.js";

const buildRecoveryInput = (input: VideoDownloadAbilityInput): ParsedVideoDownloadAbilityInput => ({
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: "download-web-video-once" as const,
  missionId: typeof input.missionId === "string" ? input.missionId : "unknown",
  runId: typeof input.runId === "string" ? input.runId : "unknown",
  capabilityCallId: typeof input.capabilityCallId === "string" ? input.capabilityCallId : "unknown",
  sourcePageUrl: typeof input.sourcePageUrl === "string" ? input.sourcePageUrl : "https://example.com/",
  preferredQuality: "best_available" as const,
  maxBytes: 200_000_000,
  timeoutMs: 60_000,
});

const inputParseFailure = (input: VideoDownloadAbilityInput): VideoDownloadResult =>
  buildVideoDownloadFailure(
    { input: buildRecoveryInput(input), startedAt: new Date().toISOString() },
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
