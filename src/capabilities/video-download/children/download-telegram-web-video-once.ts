import { createHash } from "node:crypto";

import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadCandidate,
  VideoDownloadResult,
} from "../schema.js";
import {
  buildVideoDownloadFailure,
  buildVideoDownloadSuccess,
} from "../runtime/result.js";
import { buildTelegramWebCacheProbeScript } from "../runtime/telegram-web-cache-probe-script.js";

type ParsedDownloadTelegramWebVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-telegram-web-video-once" }
>;

type TelegramProbeRange = {
  start: number;
  end: number;
  byteLength: number;
  total: number;
};

type TelegramProbeSuccess = {
  ok: true;
  status: "success";
  candidateKind: "telegram_sw_progressive_cache";
  documentId: string;
  contentType: string;
  byteSize: number;
  ranges: TelegramProbeRange[];
  bytesBase64: string;
};

type TelegramProbeFailure = {
  ok: false;
  status: "failed" | "review_required" | "invalid_input";
  failureReason: Parameters<typeof buildVideoDownloadFailure>[1];
  reason: string;
};

type TelegramProbeResult = TelegramProbeSuccess | TelegramProbeFailure;

const TELEGRAM_WEB_HOST = "web.telegram.org";

const isTelegramSource = (sourcePageUrl: string): boolean => {
  try {
    return new URL(sourcePageUrl).hostname.toLowerCase() === TELEGRAM_WEB_HOST;
  } catch {
    return false;
  }
};

const isMp4Container = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) return false;
  return new TextDecoder("ascii").decode(bytes.slice(4, 12)).includes("ftyp");
};

const decodeBase64 = (base64: string): Uint8Array =>
  new Uint8Array(Buffer.from(base64, "base64"));

const hashDocumentId = (documentId: string): string =>
  createHash("sha256").update(documentId).digest("hex").slice(0, 24);

const buildCandidate = (input: ParsedDownloadTelegramWebVideoInput): VideoDownloadCandidate => ({
  kind: "telegram_sw_progressive_cache",
  url: input.sourcePageUrl,
  source: "telegram-web-cache-storage",
  quality: "unknown",
});

const validateProbeBytes = (probe: TelegramProbeSuccess, bytes: Uint8Array): string | null => {
  if (!probe.contentType.toLowerCase().startsWith("video/")) {
    return `Telegram Web cached media MIME is ${probe.contentType || "missing"}.`;
  }
  if (bytes.length === 0) return "Telegram Web cached media produced an empty file.";
  if (bytes.length !== probe.byteSize) {
    return "Telegram Web cached media byte size does not match probe metadata.";
  }
  if (probe.contentType.toLowerCase().includes("mp4") && !isMp4Container(bytes)) {
    return "Telegram Web cached media is not a valid MP4 container.";
  }
  if (probe.ranges.length === 0) return "Telegram Web cached media has no range coverage proof.";
  return null;
};

const writeArtifact = (
  input: ParsedDownloadTelegramWebVideoInput,
  context: VideoDownloadExecutionContext,
  bytes: Uint8Array,
  contentType: string,
  documentHash: string,
) => context.artifactStoragePort.writeVideoArtifact({
    missionId: input.missionId,
    runId: input.runId,
    artifactId: `telegram_web_${documentHash}_${Date.now()}`,
    extension: contentType.includes("webm") ? ".webm" : ".mp4",
    bytes,
    contentType,
    createdAt: new Date().toISOString(),
    artifactDisposition: input.artifactDisposition,
  });

const asFailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown Telegram Web video download failure.";

const evaluateTelegramProbe = async (
  input: ParsedDownloadTelegramWebVideoInput,
  context: VideoDownloadExecutionContext,
  abortSignal: AbortSignal,
): Promise<TelegramProbeResult> => {
  const evaluateTelegramPage = context.browserMediaSourcePort.evaluateSourcePage
    ?? ((request: {
      script: string;
      description: string;
      abortSignal?: AbortSignal;
    }) => context.browserMediaSourcePort.evaluateActiveTab<TelegramProbeResult>(request));
  return evaluateTelegramPage<TelegramProbeResult>({
    sourcePageUrl: input.sourcePageUrl,
    script: buildTelegramWebCacheProbeScript(input.maxBytes, input.telegramDocumentIdHash),
    description: "collect Telegram Web cached video media bytes",
    abortSignal,
  });
};

const buildCandidateBase = (
  base: { input: ParsedDownloadTelegramWebVideoInput; startedAt: string },
  candidate: VideoDownloadCandidate,
) => ({
  ...base,
  candidate,
  candidateHost: TELEGRAM_WEB_HOST,
});

const buildSuccessfulTelegramDownload = async (input: {
  base: { input: ParsedDownloadTelegramWebVideoInput; startedAt: string };
  probe: TelegramProbeSuccess;
  context: VideoDownloadExecutionContext;
}): Promise<VideoDownloadResult> => {
  const candidate = buildCandidate(input.base.input);
  const candidateBase = buildCandidateBase(input.base, candidate);
  const bytes = decodeBase64(input.probe.bytesBase64);
  if (bytes.length > input.base.input.maxBytes) {
    return buildVideoDownloadFailure(
      candidateBase,
      "download_too_large",
      "Telegram Web cached media exceeds maxBytes.",
      "review_required",
    );
  }
  const validationFailure = validateProbeBytes(input.probe, bytes);
  if (validationFailure) {
    return buildVideoDownloadFailure(
      candidateBase,
      "metadata_validation_failed",
      validationFailure,
    );
  }
  const documentHash = hashDocumentId(input.probe.documentId);
  const artifact = await writeArtifact(
    input.base.input,
    input.context,
    bytes,
    input.probe.contentType,
    documentHash,
  );
  return buildVideoDownloadSuccess({
    ...candidateBase,
    contentType: input.probe.contentType,
    byteSize: input.probe.byteSize,
    durationMs: null,
    width: null,
    height: null,
    artifactRef: artifact.artifactRef,
    storageRef: artifact.storageRef,
    filePath: artifact.filePath,
    sha256: artifact.sha256,
    artifactDisposition: artifact.artifactDisposition,
    videoId: `telegram-document-${documentHash}`,
  });
};

const executeDownloadTelegramWebVideoOnce = async (
  input: ParsedDownloadTelegramWebVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> => {
  const base = { input, startedAt: new Date().toISOString() };
  if (!isTelegramSource(input.sourcePageUrl)) {
    return buildVideoDownloadFailure(
      base,
      "source_page_mismatch",
      "Telegram Web child only accepts web.telegram.org source pages.",
      "invalid_input",
    );
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
  try {
    const probe = await evaluateTelegramProbe(
      input,
      context,
      abortController.signal,
    );
    if (!probe.ok) {
      return buildVideoDownloadFailure(base, probe.failureReason, probe.reason, probe.status);
    }
    return buildSuccessfulTelegramDownload({ base, probe, context });
  } catch (error) {
    return buildVideoDownloadFailure(base, "network_failed", asFailureMessage(error), "review_required");
  } finally {
    clearTimeout(timeout);
  }
};

export const downloadTelegramWebVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-telegram-web-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadTelegramWebVideoOnce(input as ParsedDownloadTelegramWebVideoInput, context),
};
