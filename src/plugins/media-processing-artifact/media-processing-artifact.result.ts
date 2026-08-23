import { z } from "zod";

import { MediaProcessingResultSchema } from "../../capabilities/media-processing/index.js";

export const MediaProcessingArtifactJobResultSchema = z.object({
  jobType: z.literal("media-processing-artifact"),
  status: z.enum(["success", "failed", "review_required", "invalid_input"]),
  result: MediaProcessingResultSchema,
}).strict();

export type MediaProcessingArtifactJobResult = z.infer<typeof MediaProcessingArtifactJobResultSchema>;
