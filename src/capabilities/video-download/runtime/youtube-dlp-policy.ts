import type { ParsedVideoDownloadAbilityInput } from "../schema.js";
import type { VideoDownloadFailureReason } from "../type-contracts.js";

type ParsedYoutubeInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-youtube-video-once" }
>;

export type YoutubeDlpFailure = {
  failureReason: VideoDownloadFailureReason;
  reason: string;
  reviewRequired: boolean;
};

const YOUTUBE_DEFAULT_TIMEOUT_MS = 120_000;
export const YOUTUBE_PROGRESS_INTERVAL_MS = 5_000;
export const YOUTUBE_PROCESS_KILL_GRACE_MS = 2_000;

export const youtubeTimeoutSeconds = (
  input: Pick<ParsedYoutubeInput, "timeoutMs"> = { timeoutMs: YOUTUBE_DEFAULT_TIMEOUT_MS },
): number =>
  Math.max(10, Math.ceil(input.timeoutMs / 1000));

export const youtubeMetadataTimeoutSeconds = (input: Pick<ParsedYoutubeInput, "timeoutMs">): number =>
  Math.max(10, Math.min(30, youtubeTimeoutSeconds(input)));

const includesAny = (value: string, needles: readonly string[]): boolean =>
  needles.some((needle) => value.includes(needle));

export const sanitizeYoutubeProgressLine = (value: string): string | null => {
  const line = value.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean).at(-1);
  if (!line) return null;
  return line
    .replace(/\s+/gu, " ")
    .replace(/https?:\/\/\S+/giu, "[redacted-url]")
    .slice(0, 240);
};

export const classifyYoutubeDlpFailure = (error: unknown): YoutubeDlpFailure => {
  const message = error instanceof Error ? error.message : "Unknown YouTube download failure.";
  const lower = message.toLowerCase();
  if (includesAny(lower, ["aborted", "abort", "timed out", "timeout"])) {
    return {
      failureReason: "network_failed",
      reason: "YouTube download timed out before producing a verified artifact.",
      reviewRequired: false,
    };
  }
  if (includesAny(lower, ["private video", "members-only", "drm"])) {
    return { failureReason: "drm_or_private_video", reason: message, reviewRequired: true };
  }
  if (includesAny(lower, ["captcha", "2fa", "confirm your age"])) {
    return { failureReason: "captcha_or_2fa_required", reason: message, reviewRequired: true };
  }
  if (includesAny(lower, ["sign in", "login", "permission"])) {
    return { failureReason: "login_required", reason: message, reviewRequired: true };
  }
  if (includesAny(lower, ["unavailable", "removed", "not found"])) {
    return { failureReason: "download_expired", reason: message, reviewRequired: false };
  }
  return { failureReason: "network_failed", reason: message, reviewRequired: false };
};
