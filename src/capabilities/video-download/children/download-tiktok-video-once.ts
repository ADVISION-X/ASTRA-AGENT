import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedVideoDownloadAbilityInput,
  VideoDownloadCandidate,
  VideoDownloadResult,
} from "../schema.js";
import { validateFacebookMediaCandidate } from "../runtime/candidate-validation.js";
import { normalizeTikTokCandidates, parseTikTokMediaProbe } from "../runtime/tiktok-candidates.js";
import { downloadValidatedMedia } from "../runtime/media-download.js";
import {
  buildVideoDownloadFailure,
  buildVideoDownloadSuccess,
} from "../runtime/result.js";
import { createVideoDownloadAbortHandle } from "../runtime/abort-handle.js";

type ParsedDownloadTikTokVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-tiktok-video-once" }
>;

const asFailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown video download failure.";

const probePage = async (
  input: ParsedDownloadTikTokVideoInput,
  context: VideoDownloadExecutionContext,
  abortSignal: AbortSignal,
) => parseTikTokMediaProbe(await context.browserPageObservationPort.observeTikTokVideoCandidates({
  sourcePageUrl: input.sourcePageUrl,
  maxCandidates: 24,
  abortSignal,
}));

const writeArtifact = (
  input: ParsedDownloadTikTokVideoInput,
  context: VideoDownloadExecutionContext,
  downloaded: Awaited<ReturnType<typeof downloadValidatedMedia>> & { ok: true },
) => context.artifactStoragePort.writeVideoArtifact({
  missionId: input.missionId,
  runId: input.runId,
  artifactId: `tiktok_${Date.now()}`,
  extension: ".mp4",
  bytes: downloaded.bytes,
  contentType: downloaded.contentType,
  createdAt: new Date().toISOString(),
  artifactDisposition: input.artifactDisposition,
});

async function tryCandidate(
  input: ParsedDownloadTikTokVideoInput,
  context: VideoDownloadExecutionContext,
  candidate: VideoDownloadCandidate,
  abortSignal: AbortSignal,
  videoFact: { width: number | null; height: number | null; duration: number | null } | null,
): Promise<VideoDownloadResult | null> {
  const base = { input, startedAt: new Date().toISOString(), candidate };
  const validation = await validateFacebookMediaCandidate(candidate, abortSignal);
  if (!validation.ok) return null;
  const downloaded = await downloadValidatedMedia(validation, input.maxBytes, abortSignal);
  if (!downloaded.ok) return null;
  const artifact = await writeArtifact(input, context, downloaded);
  return buildVideoDownloadSuccess({
    ...base,
    candidateHost: validation.host,
    contentType: downloaded.contentType,
    byteSize: downloaded.byteSize,
    durationMs: videoFact?.duration ? Math.round(videoFact.duration * 1000) : null,
    width: videoFact?.width ?? null,
    height: videoFact?.height ?? null,
    artifactRef: artifact.artifactRef,
    storageRef: artifact.storageRef,
    filePath: artifact.filePath,
    sha256: artifact.sha256,
    artifactDisposition: artifact.artifactDisposition,
    videoId: null,
  });
}

async function executeDownloadTikTokVideoOnce(
  input: ParsedDownloadTikTokVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  const abortHandle = createVideoDownloadAbortHandle(input.timeoutMs, context.abortSignal);
  try {
    const probe = await probePage(input, context, abortHandle.signal);
    if (!probe) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "TikTok media probe returned no structured result.");
    }
    const candidates = normalizeTikTokCandidates(probe);
    if (candidates.length === 0) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "No video candidates found on TikTok page.");
    }
    for (const candidate of candidates) {
      const result = await tryCandidate(input, context, candidate, abortHandle.signal, probe.videoFact);
      if (result) return result;
    }
    return buildVideoDownloadFailure(base, "candidate_not_video", "TikTok video candidates failed validation or download.");
  } catch (error) {
    return buildVideoDownloadFailure(base, "network_failed", asFailureMessage(error));
  } finally {
    abortHandle.dispose();
  }
}

export const downloadTikTokVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-tiktok-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadTikTokVideoOnce(input as ParsedDownloadTikTokVideoInput, context),
};
