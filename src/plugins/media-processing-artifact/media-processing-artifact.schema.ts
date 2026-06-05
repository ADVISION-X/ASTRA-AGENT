import { z } from "zod";

const MediaProcessingArtifactChildSchema = z.enum([
  "optimize-image-for-web-once",
  "resize-image-for-web-once",
  "generate-responsive-image-variants-once",
  "optimize-video-for-web-once",
  "compress-video-for-web-once",
  "generate-video-poster-once",
]);

export const MediaProcessingArtifactJobInputSchema = z.object({
  jobType: z.literal("media-processing-artifact"),
  inputFilePath: z.string().min(1),
  childCapabilityId: MediaProcessingArtifactChildSchema,
  presetId: z.enum([
    "web-image",
    "web-image-responsive",
    "web-video",
    "web-video-compressed",
    "web-video-poster",
  ]).optional(),
  outputFormat: z.enum(["webp", "jpeg", "png", "mp4"]).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  maxWidth: z.number().int().min(1).max(8192).optional(),
  maxHeight: z.number().int().min(1).max(8192).optional(),
  targetWidth: z.number().int().min(1).max(8192).optional(),
  targetHeight: z.number().int().min(1).max(8192).optional(),
  variantWidths: z.array(z.number().int().min(1).max(8192)).min(1).max(8).optional(),
  posterTimestampSeconds: z.number().min(0).max(86_400).optional(),
  targetMaxBytes: z.number().int().min(1).max(250_000_000).optional(),
  targetBitrateKbps: z.number().int().min(64).max(20_000).optional(),
  timeoutMs: z.number().int().min(1000).max(3_600_000).optional(),
  artifactPolicy: z.enum(["deliverable", "staging"]).default("deliverable"),
}).strict();

export type MediaProcessingArtifactJobInput = z.infer<typeof MediaProcessingArtifactJobInputSchema>;
