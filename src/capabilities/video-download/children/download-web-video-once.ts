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
import {
  normalizeUniversalCandidates,
  parseUniversalProbeResult,
} from "../runtime/universal-candidates.js";
import { UNIVERSAL_PAGE_PROBE_SCRIPT } from "../runtime/universal-page-probe-script.js";
import { downloadValidatedMedia } from "../runtime/media-download.js";
import {
  buildVideoDownloadFailure,
  buildVideoDownloadSuccess,
} from "../runtime/result.js";

type ParsedDownloadWebVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-web-video-once" }
>;

const asFailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown video download failure.";

const probeActivePage = async (
  context: VideoDownloadExecutionContext,
  abortSignal: AbortSignal,
) => parseUniversalProbeResult(await context.browserMediaSourcePort.evaluateActiveTab({
  script: UNIVERSAL_PAGE_PROBE_SCRIPT,
  description: "collect universal video media candidates",
  abortSignal,
}));

const writeArtifact = (
  input: ParsedDownloadWebVideoInput,
  context: VideoDownloadExecutionContext,
  candidate: VideoDownloadCandidate,
  downloaded: Awaited<ReturnType<typeof downloadValidatedMedia>> & { ok: true },
) => context.artifactStoragePort.writeVideoArtifact({
  missionId: input.missionId,
  runId: input.runId,
  artifactId: `web_${Date.now()}`,
  extension: downloaded.contentType.includes("webm") ? ".webm" : ".mp4",
  bytes: downloaded.bytes,
  contentType: downloaded.contentType,
  createdAt: new Date().toISOString(),
  artifactDisposition: input.artifactDisposition,
});

async function tryCandidate(
  input: ParsedDownloadWebVideoInput,
  context: VideoDownloadExecutionContext,
  candidate: VideoDownloadCandidate,
  abortSignal: AbortSignal,
): Promise<VideoDownloadResult | null> {
  const base = { input, startedAt: new Date().toISOString(), candidate };
  const validation = await validateFacebookMediaCandidate(candidate, abortSignal);
  if (!validation.ok) return null;
  const downloaded = await downloadValidatedMedia(validation, input.maxBytes, abortSignal);
  if (!downloaded.ok) return null;
  const artifact = await writeArtifact(input, context, candidate, downloaded);
  return buildVideoDownloadSuccess({
    ...base,
    candidateHost: validation.host,
    contentType: downloaded.contentType,
    byteSize: downloaded.byteSize,
    durationMs: null,
    width: null,
    height: null,
    artifactRef: artifact.artifactRef,
    storageRef: artifact.storageRef,
    filePath: artifact.filePath,
    sha256: artifact.sha256,
    artifactDisposition: artifact.artifactDisposition,
    videoId: null,
  });
}

async function executeDownloadWebVideoOnce(
  input: ParsedDownloadWebVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
  try {
    const probe = await probeActivePage(context, abortController.signal);
    if (!probe) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "Universal page probe returned no structured result.");
    }
    const candidates = normalizeUniversalCandidates(probe);
    if (candidates.length === 0) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "No video media candidates found on this page.");
    }
    for (const candidate of candidates) {
      const result = await tryCandidate(input, context, candidate, abortController.signal);
      if (result) return result;
    }
    return buildVideoDownloadFailure(base, "candidate_not_video", "All video candidates failed validation or download.");
  } catch (error) {
    return buildVideoDownloadFailure(base, "network_failed", asFailureMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

export const downloadWebVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-web-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadWebVideoOnce(input as ParsedDownloadWebVideoInput, context),
};
