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

const stringOrFallback = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const buildRecoveryInput = (input: VideoDownloadAbilityInput): ParsedVideoDownloadAbilityInput => ({
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: "download-web-video-once" as const,
  missionId: stringOrFallback(input.missionId, "unknown"),
  runId: stringOrFallback(input.runId, "unknown"),
  capabilityCallId: stringOrFallback(input.capabilityCallId, "unknown"),
  sourcePageUrl: stringOrFallback(input.sourcePageUrl, "https://example.com/"),
  preferredQuality: "best_available" as const,
  maxBytes: 200_000_000,
  timeoutMs: 60_000,
  artifactDisposition: "final" as const,
  downloadSubtitles: false,
  subtitleLanguages: ["en"],
});

const inputParseFailure = (input: VideoDownloadAbilityInput): VideoDownloadResult =>
  buildVideoDownloadFailure(
    { input: buildRecoveryInput(input), startedAt: new Date().toISOString() },
    "input_schema_invalid",
    "Video download input schema is invalid.",
    "invalid_input",
  );

const buildUnknownChildFailure = (
  input: ParsedVideoDownloadAbilityInput,
): VideoDownloadResult => buildVideoDownloadFailure(
    { input, startedAt: new Date().toISOString() },
    "unknown_child_capability",
    "Video download child capability is not registered.",
  );

const executeVideoDownloadRequest = async (input: {
  request: VideoDownloadAbilityInput;
  context: VideoDownloadExecutionContext;
  registry: ReturnType<typeof createVideoDownloadCapabilityRegistry>;
}): Promise<VideoDownloadResult> => {
  const parsed = VideoDownloadAbilityInputSchema.safeParse(input.request);
  if (!parsed.success) {
    return inputParseFailure(input.request);
  }
  const child = input.registry.get(parsed.data.childCapabilityId);
  if (!child) {
    return buildUnknownChildFailure(parsed.data);
  }
  return child.execute(parsed.data, input.context);
};

export const createVideoDownloadAbilityGroup = (
  context: VideoDownloadExecutionContext,
): VideoDownloadAbilityGroup => {
  const registry = createVideoDownloadCapabilityRegistry();
  return {
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    listChildCapabilityIds(): VideoDownloadChildCapabilityId[] {
      return listVideoDownloadChildren();
    },
    execute(input: VideoDownloadAbilityInput): Promise<VideoDownloadResult> {
      return executeVideoDownloadRequest({ request: input, context, registry });
    },
    promoteArtifact(input) {
      return context.artifactStoragePort.promoteVideoArtifact(input);
    },
    deleteArtifact(input) {
      return context.artifactStoragePort.deleteVideoArtifact(input);
    },
  };
};
