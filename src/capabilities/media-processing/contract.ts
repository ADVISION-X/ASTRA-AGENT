import type {
  MediaProcessingAbilityInput,
  MediaProcessingChildCapabilityId,
  MediaProcessingPublicRequest,
  MediaProcessingResult,
  ParsedMediaProcessingAbilityInput,
} from "./schema.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";

type MediaProcessingAbilityGroupId = "media-processing";

export type MediaProcessingExecutionContext = {
  dataDir: string;
  runtimeLogger?: RuntimeLogger;
};

export interface MediaProcessingAbilityGroup {
  readonly abilityGroupId: MediaProcessingAbilityGroupId;
  listChildCapabilityIds(): MediaProcessingChildCapabilityId[];
  processMedia(input: MediaProcessingPublicRequest): Promise<MediaProcessingResult>;
  execute(input: MediaProcessingAbilityInput): Promise<MediaProcessingResult>;
}

export interface MediaProcessingChildCapability {
  readonly abilityGroupId: MediaProcessingAbilityGroupId;
  readonly childCapabilityId: MediaProcessingChildCapabilityId;
  execute(
    input: ParsedMediaProcessingAbilityInput,
    context: MediaProcessingExecutionContext,
  ): Promise<MediaProcessingResult>;
}
