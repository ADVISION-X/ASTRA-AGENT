import type { ParsedVideoDownloadAbilityInput } from "../schema.js";

type ParsedYoutubeInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

const YOUTUBE_FORMAT_SELECTORS: Record<ParsedYoutubeInput["preferredQuality"], string> = {
  "2160p": "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
  "1440p": "bestvideo[height<=1440]+bestaudio/best[height<=1440]",
  "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
  "720p": "bestvideo[height<=720]+bestaudio/best[height<=720]",
  "480p": "bestvideo[height<=480]+bestaudio/best[height<=480]",
  "360p": "bestvideo[height<=360]+bestaudio/best[height<=360]",
  hd: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
  sd: "bestvideo[height<=480]+bestaudio/best[height<=480]",
  best_available: "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
};

export const formatSelector = (input: ParsedYoutubeInput): string => YOUTUBE_FORMAT_SELECTORS[input.preferredQuality];

export const youtubeArgs = (url: string): string[] => [
  "--no-playlist",
  "--extractor-args",
  "youtube:player_client=android_vr",
  url,
];

export const subtitleArgs = (input: ParsedYoutubeInput): string[] => {
  if (!input.downloadSubtitles) return [];
  return [
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    input.subtitleLanguages.join(","),
    "--sub-format",
    "vtt/srt/best",
  ];
};
