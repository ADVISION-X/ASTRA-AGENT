import { createId } from "../../lib/local-runtime/ids.js";
import type { MediaProcessingAbilityGroup } from "../../capabilities/media-processing/index.js";
import {
  MediaProcessingArtifactJobInputSchema,
  type MediaProcessingArtifactJobInput,
} from "./media-processing-artifact.schema.js";
import {
  MediaProcessingArtifactJobResultSchema,
  type MediaProcessingArtifactJobResult,
} from "./media-processing-artifact.result.js";

type MediaProcessingArtifactFlowContext = {
  mediaProcessing: MediaProcessingAbilityGroup;
};

export const runMediaProcessingArtifactFlow = async (
  input: MediaProcessingArtifactJobInput,
  context: MediaProcessingArtifactFlowContext,
): Promise<MediaProcessingArtifactJobResult> => {
  const jobInput = MediaProcessingArtifactJobInputSchema.parse(input);
  const result = await context.mediaProcessing.processMedia({
    missionId: createId("media_processing_job"),
    runId: createId("media_processing_run"),
    inputFilePath: jobInput.inputFilePath,
    childCapabilityId: jobInput.childCapabilityId,
    ...(jobInput.presetId ? { presetId: jobInput.presetId } : {}),
    ...(jobInput.outputFormat ? { outputFormat: jobInput.outputFormat } : {}),
    ...(jobInput.quality ? { quality: jobInput.quality } : {}),
    ...(jobInput.maxWidth ? { maxWidth: jobInput.maxWidth } : {}),
    ...(jobInput.maxHeight ? { maxHeight: jobInput.maxHeight } : {}),
    ...(jobInput.targetWidth ? { targetWidth: jobInput.targetWidth } : {}),
    ...(jobInput.targetHeight ? { targetHeight: jobInput.targetHeight } : {}),
    ...(jobInput.variantWidths ? { variantWidths: jobInput.variantWidths } : {}),
    ...(jobInput.targetMaxBytes ? { targetMaxBytes: jobInput.targetMaxBytes } : {}),
    ...(jobInput.targetBitrateKbps ? { targetBitrateKbps: jobInput.targetBitrateKbps } : {}),
    ...(jobInput.posterTimestampSeconds ? { posterTimestampSeconds: jobInput.posterTimestampSeconds } : {}),
    timeoutMs: jobInput.timeoutMs ?? 120_000,
    artifactPolicy: jobInput.artifactPolicy,
  });

  return MediaProcessingArtifactJobResultSchema.parse({
    jobType: "media-processing-artifact",
    status: result.status,
    result,
  });
};
