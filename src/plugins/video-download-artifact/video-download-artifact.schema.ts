import { z } from "zod";

export const VideoDownloadArtifactJobTypeSchema = z.literal("video-download-artifact");

export const VideoDownloadArtifactQualitySchema = z.enum([
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "hd",
  "sd",
  "best_available",
]);

export const VideoDownloadArtifactChildCapabilitySchema = z.enum([
  "download-web-video-once",
  "download-facebook-video-once",
  "download-tiktok-video-once",
  "download-instagram-video-once",
  "download-bilibili-video-once",
  "download-douyin-video-once",
  "download-x-video-once",
  "download-xiaohongshu-video-once",
  "download-youtube-video-once",
]);

export const VideoDownloadArtifactJobInputSchema = z.object({
  jobType: VideoDownloadArtifactJobTypeSchema.default("video-download-artifact"),
  sourcePageUrl: z.string().url(),
  childCapabilityId: VideoDownloadArtifactChildCapabilitySchema.default("download-web-video-once"),
  preferredQuality: VideoDownloadArtifactQualitySchema.default("best_available"),
  maxBytes: z.number().int().min(1024).max(500_000_000).default(200_000_000),
  timeoutMs: z.number().int().min(1000).max(3_600_000).default(60_000),
  downloadSubtitles: z.boolean().default(false),
  subtitleLanguages: z.array(z.string().min(1)).max(8).default(["en"]),
}).strict();

export type VideoDownloadArtifactJobInput = z.input<typeof VideoDownloadArtifactJobInputSchema>;
export type ParsedVideoDownloadArtifactJobInput = z.output<typeof VideoDownloadArtifactJobInputSchema>;
export type VideoDownloadArtifactChildCapabilityId = z.infer<typeof VideoDownloadArtifactChildCapabilitySchema>;
export type VideoDownloadArtifactQuality = z.infer<typeof VideoDownloadArtifactQualitySchema>;
