import { z } from "zod";

const VideoDownloadArtifactJobTypeSchema = z.literal("video-download-artifact");

const VideoDownloadArtifactQualitySchema = z.enum([
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

const VideoDownloadArtifactPlatformSchema = z.enum([
  "universal",
  "facebook",
  "tiktok",
  "instagram",
  "bilibili",
  "douyin",
  "x",
  "xiaohongshu",
  "youtube",
  "telegram-web",
]);

export const VideoDownloadArtifactJobInputSchema = z.object({
  jobType: VideoDownloadArtifactJobTypeSchema.default("video-download-artifact"),
  sourcePageUrl: z.string().url(),
  platform: VideoDownloadArtifactPlatformSchema.default("universal"),
  preferredQuality: VideoDownloadArtifactQualitySchema.default("best_available"),
  maxBytes: z.number().int().min(1024).max(5_000_000_000).default(5_000_000_000),
  timeoutMs: z.number().int().min(1000).max(3_600_000).default(3_600_000),
  downloadSubtitles: z.boolean().default(false),
  subtitleLanguages: z.array(z.string().min(1)).max(8).default(["en"]),
  telegramDocumentIdHash: z.string().regex(/^[a-f0-9]{24}$/u).optional(),
}).strict();

export type VideoDownloadArtifactJobInput = z.input<typeof VideoDownloadArtifactJobInputSchema>;
