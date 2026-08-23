import { z } from "zod";

export const videoDownloadCandidateSchema = z.object({
  kind: z.enum([
    "native_hd",
    "native_sd",
    "video_element",
    "source_element",
    "media_resource",
    "hls_manifest",
    "dash_manifest",
  ]),
  url: z.string().url(),
  source: z.string().min(1),
  quality: z.enum(["hd", "sd", "unknown"]),
}).strict();