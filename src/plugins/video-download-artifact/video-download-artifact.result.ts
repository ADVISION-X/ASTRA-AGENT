import { z } from "zod";

import { VideoDownloadResultSchema } from "../../capabilities/video-download/schema.js";

export const VideoDownloadArtifactJobResultSchema = z.object({
  jobType: z.literal("video-download-artifact"),
  status: z.enum(["success", "failed", "review_required", "invalid_input"]),
  result: VideoDownloadResultSchema,
}).strict();

export type VideoDownloadArtifactJobResult = z.infer<typeof VideoDownloadArtifactJobResultSchema>;
