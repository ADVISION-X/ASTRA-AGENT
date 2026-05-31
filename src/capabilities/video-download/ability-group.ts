import { randomUUID } from "node:crypto";

import type {
  VideoDownloadAbilityGroup,
  VideoDownloadExecutionContext,
} from "./contract.js";
import type { BrowserMediaSourcePort } from "./ports/browser-media-source-port.js";
import {
  VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  VideoDownloadAbilityInputSchema,
  VideoDownloadPublicRequestSchema,
  type ParsedVideoDownloadAbilityInput,
  type VideoDownloadAbilityInput,
  type VideoDownloadChildCapabilityId,
  type VideoDownloadPublicPlatform,
  type VideoDownloadPublicRequest,
  type VideoDownloadResult,
} from "./schema.js";
import {
  createVideoDownloadCapabilityRegistry,
  listVideoDownloadChildren,
} from "./registry.js";
import { createFilesystemVideoArtifactStoragePort } from "./runtime/artifact-storage.js";
import { buildVideoDownloadFailure } from "./runtime/result.js";
import { buildTelegramWebVisibleMediaProbeScript } from "./runtime/telegram-web-visible-media-probe-script.js";
import { resolveYtDlpBinaryPath } from "./runtime/youtube-dlp-binary.js";
import { maxYoutubeHeightForQuality, youtubeDisplayTitle, youtubeExpectedSubtitleLanguages, youtubeLanguageMatches } from "./runtime/youtube-dlp-download.js";
import { verifyFfprobeAvailable } from "./runtime/youtube-dlp-output.js";

export type TelegramWebVisibleVideoCandidate = {
  documentIdHash: string;
  sourceKind: "visible_progressive_video";
  redactedPathPrefix: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  readyState: number;
  visible: boolean;
  viewportRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cacheStorageAvailable: boolean;
  cacheComplete: boolean;
  cachedByteSize: number | null;
  cacheRangeCount: number;
};

export type TelegramWebVisibleMediaProbeResult = {
  ok: boolean;
  status: "success" | "failed" | "review_required" | "invalid_input";
  sourcePageUrl?: string;
  candidateCount?: number;
  candidates?: TelegramWebVisibleVideoCandidate[];
  failureReason?: string;
  reason?: string;
};

const stringOrFallback = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const buildRecoveryInput = (input: VideoDownloadAbilityInput): ParsedVideoDownloadAbilityInput => ({
  abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
  childCapabilityId: "download-web-video-once" as const,
  missionId: stringOrFallback(input.missionId, "unknown"),
  runId: stringOrFallback(input.runId, "unknown"),
  capabilityCallId: stringOrFallback(input.capabilityCallId, "unknown"),
  sourcePageUrl: stringOrFallback(input.sourcePageUrl, "https://example.com/"),
  preferredQuality: "best_available" as const,
  maxBytes: 200_000_000,
  timeoutMs: 60_000,
  artifactDisposition: "final" as const,
  downloadSubtitles: false,
  subtitleLanguages: ["en"],
});

const inputParseFailure = (input: VideoDownloadAbilityInput): VideoDownloadResult =>
  buildVideoDownloadFailure(
    { input: buildRecoveryInput(input), startedAt: new Date().toISOString() },
    "input_schema_invalid",
    "Video download input schema is invalid.",
    "invalid_input",
  );

const buildUnknownChildFailure = (
  input: ParsedVideoDownloadAbilityInput,
): VideoDownloadResult => buildVideoDownloadFailure(
    { input, startedAt: new Date().toISOString() },
    "unknown_child_capability",
    "Video download child capability is not registered.",
  );

const childCapabilityIdByPlatform: Record<VideoDownloadPublicPlatform, VideoDownloadChildCapabilityId> = {
  facebook: "download-facebook-video-once",
  tiktok: "download-tiktok-video-once",
  instagram: "download-instagram-video-once",
  bilibili: "download-bilibili-video-once",
  douyin: "download-douyin-video-once",
  x: "download-x-video-once",
  xiaohongshu: "download-xiaohongshu-video-once",
  youtube: "download-youtube-video-once",
  "telegram-web": "download-telegram-web-video-once",
  universal: "download-web-video-once",
};

const resolveChildCapabilityId = (platform: VideoDownloadPublicPlatform): VideoDownloadChildCapabilityId =>
  childCapabilityIdByPlatform[platform];

const buildPublicRequestInput = (input: VideoDownloadPublicRequest): VideoDownloadAbilityInput => {
  const parsed = VideoDownloadPublicRequestSchema.parse(input);
  return {
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    childCapabilityId: resolveChildCapabilityId(parsed.platform),
    missionId: parsed.missionId,
    runId: parsed.runId,
    ...(parsed.sessionId ? { sessionId: parsed.sessionId } : {}),
    ...(parsed.roundId ? { roundId: parsed.roundId } : {}),
    capabilityCallId: `${parsed.runId}_${resolveChildCapabilityId(parsed.platform)}_${randomUUID()}`,
    sourcePageUrl: parsed.sourcePageUrl,
    preferredQuality: parsed.preferredQuality,
    maxBytes: parsed.maxBytes,
    timeoutMs: parsed.timeoutMs,
    artifactDisposition: parsed.artifactPolicy === "staging" ? "staging" : "final",
    downloadSubtitles: parsed.downloadSubtitles,
    subtitleLanguages: parsed.subtitleLanguages,
    ...(parsed.telegramDocumentIdHash ? { telegramDocumentIdHash: parsed.telegramDocumentIdHash } : {}),
  };
};

const executeVideoDownloadRequest = async (input: {
  request: VideoDownloadAbilityInput;
  context: VideoDownloadExecutionContext;
  registry: ReturnType<typeof createVideoDownloadCapabilityRegistry>;
}): Promise<VideoDownloadResult> => {
  const parsed = VideoDownloadAbilityInputSchema.safeParse(input.request);
  if (!parsed.success) {
    return inputParseFailure(input.request);
  }
  const child = input.registry.get(parsed.data.childCapabilityId);
  if (!child) {
    return buildUnknownChildFailure(parsed.data);
  }
  return child.execute(parsed.data, input.context);
};

export const createVideoDownloadAbilityGroup = (
  context: VideoDownloadExecutionContext,
): VideoDownloadAbilityGroup => {
  const registry = createVideoDownloadCapabilityRegistry();
  return {
    abilityGroupId: VIDEO_DOWNLOAD_ABILITY_GROUP_ID,
    listChildCapabilityIds(): VideoDownloadChildCapabilityId[] {
      return listVideoDownloadChildren();
    },
    downloadVideo(input: VideoDownloadPublicRequest): Promise<VideoDownloadResult> {
      return executeVideoDownloadRequest({
        request: buildPublicRequestInput(input),
        context,
        registry,
      });
    },
    execute(input: VideoDownloadAbilityInput): Promise<VideoDownloadResult> {
      return executeVideoDownloadRequest({ request: input, context, registry });
    },
    promoteArtifact(input) {
      return context.artifactStoragePort.promoteVideoArtifact(input);
    },
    deleteArtifact(input) {
      return context.artifactStoragePort.deleteVideoArtifact(input);
    },
  };
};

export const createVideoDownloadAbilityGroupFromFilesystem = (input: {
  browserMediaSourcePort: BrowserMediaSourcePort;
  dataDir: string;
  runtimeLogger?: import("../../lib/runtime-logs/index.js").RuntimeLogger;
}): VideoDownloadAbilityGroup =>
  createVideoDownloadAbilityGroup({
    browserMediaSourcePort: input.browserMediaSourcePort,
    artifactStoragePort: createFilesystemVideoArtifactStoragePort(input.dataDir),
    ...(input.runtimeLogger ? { runtimeLogger: input.runtimeLogger } : {}),
  });

export const probeTelegramWebVisibleMediaSourcePage = async (input: {
  browserMediaSourcePort: BrowserMediaSourcePort;
  sourcePageUrl: string;
  abortSignal?: AbortSignal;
}): Promise<TelegramWebVisibleMediaProbeResult> => {
  if (!input.browserMediaSourcePort.evaluateSourcePage) {
    return {
      ok: false,
      status: "review_required",
      sourcePageUrl: input.sourcePageUrl,
      candidateCount: 0,
      candidates: [],
      failureReason: "source_page_evaluation_unavailable",
      reason: "Browser media source port does not support source page evaluation.",
    };
  }
  return input.browserMediaSourcePort.evaluateSourcePage<TelegramWebVisibleMediaProbeResult>({
    sourcePageUrl: input.sourcePageUrl,
    script: buildTelegramWebVisibleMediaProbeScript(),
    description: "collect Telegram Web visible media list",
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
};

export const prepareVideoDownloadRuntimeDependencies = async (): Promise<void> => {
  await resolveYtDlpBinaryPath({ refresh: process.env.GRASSEYE_YT_DLP_AUTO_UPDATE !== "0" });
  await verifyFfprobeAvailable();
};

type YoutubeProductionQuality = NonNullable<VideoDownloadPublicRequest["preferredQuality"]>;

export const youtubeProductionLanguageMatches = (
  requestedLanguage: string,
  availableLanguage: string,
): boolean => youtubeLanguageMatches(requestedLanguage, availableLanguage);

export const youtubeProductionMaxHeightForQuality = (quality: YoutubeProductionQuality): number =>
  maxYoutubeHeightForQuality(quality);

export const youtubeProductionExpectedSubtitleLanguages = (
  availableLanguages: readonly string[],
  requestedLanguages: readonly string[],
  downloadSubtitles: boolean,
): string[] => [...youtubeExpectedSubtitleLanguages(availableLanguages, requestedLanguages, downloadSubtitles)];

export const youtubeProductionDisplayTitle = (sourceTitle: string): string =>
  youtubeDisplayTitle(sourceTitle);
