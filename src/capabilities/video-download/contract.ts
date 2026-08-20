import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadAbilityInput,
  VideoDownloadArtifact,
  VideoDownloadChildCapabilityId,
  VideoDownloadPublicRequest,
  VideoDownloadResult,
} from "./schema.js";
import type { BrowserPageObservationPort } from "./ports/browser-page-observation-port.js";
import type { VideoArtifactStoragePort } from "./ports/video-artifact-storage-port.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";

type VideoDownloadAbilityGroupId = "video-download";

export type VideoDownloadExecutionContext = {
  browserPageObservationPort: BrowserPageObservationPort;
  artifactStoragePort: VideoArtifactStoragePort;
  runtimeLogger?: RuntimeLogger;
  abortSignal?: AbortSignal;
};

export interface VideoDownloadAbilityGroup {
  readonly abilityGroupId: VideoDownloadAbilityGroupId;
  listChildCapabilityIds(): VideoDownloadChildCapabilityId[];
  downloadVideo(input: VideoDownloadPublicRequest, options?: { abortSignal?: AbortSignal }): Promise<VideoDownloadResult>;
  execute(input: VideoDownloadAbilityInput): Promise<VideoDownloadResult>;
  promoteArtifact(input: {
    artifact: VideoDownloadArtifact;
    destinationFilePath: string;
  }): Promise<VideoDownloadArtifact>;
  deleteArtifact(input: {
    artifact: VideoDownloadArtifact;
  }): Promise<void>;
}

export interface VideoDownloadChildCapability {
  readonly abilityGroupId: VideoDownloadAbilityGroupId;
  readonly childCapabilityId: VideoDownloadChildCapabilityId;
  execute(
    input: ParsedVideoDownloadAbilityInput,
    context: VideoDownloadExecutionContext,
  ): Promise<VideoDownloadResult>;
}
