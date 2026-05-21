import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadAbilityInput,
  VideoDownloadChildCapabilityId,
  VideoDownloadResult,
} from "./schema.js";
import type { BrowserMediaSourcePort } from "./ports/browser-media-source-port.js";
import type { VideoArtifactStoragePort } from "./ports/video-artifact-storage-port.js";

export type VideoDownloadAbilityGroupId = "video-download";

export type VideoDownloadExecutionContext = {
  browserMediaSourcePort: BrowserMediaSourcePort;
  artifactStoragePort: VideoArtifactStoragePort;
};

export interface VideoDownloadAbilityGroup {
  readonly abilityGroupId: VideoDownloadAbilityGroupId;
  listChildCapabilityIds(): VideoDownloadChildCapabilityId[];
  execute(input: VideoDownloadAbilityInput): Promise<VideoDownloadResult>;
}

export interface VideoDownloadChildCapability {
  readonly abilityGroupId: VideoDownloadAbilityGroupId;
  readonly childCapabilityId: VideoDownloadChildCapabilityId;
  execute(
    input: ParsedVideoDownloadAbilityInput,
    context: VideoDownloadExecutionContext,
  ): Promise<VideoDownloadResult>;
}

export type {
  VideoDownloadAbilityInput,
  VideoDownloadChildCapabilityId,
  VideoDownloadResult,
};
