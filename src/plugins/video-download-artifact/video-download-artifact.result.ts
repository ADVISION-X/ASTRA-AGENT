import { z } from "zod";

import type { VideoDownloadResult } from "../../capabilities/video-download/index.js";

export const VideoDownloadArtifactJobResultSchema = z.object({
  jobType: z.literal("video-download-artifact"),
  status: z.enum(["success", "failed", "review_required", "invalid_input"]),
  result: z.custom<VideoDownloadResult>((value) =>
    Boolean(value && typeof value === "object" && "abilityGroupId" in value && "output" in value)),
}).strict();

export type VideoDownloadArtifactJobResult = z.infer<typeof VideoDownloadArtifactJobResultSchema>;
