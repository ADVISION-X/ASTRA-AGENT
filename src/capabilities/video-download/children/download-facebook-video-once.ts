import { randomUUID } from "node:crypto";

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
  normalizeFacebookCandidates,
  parseFacebookMediaProbe,
} from "../runtime/facebook-candidates.js";
import { FACEBOOK_MEDIA_PROBE_SCRIPT } from "../runtime/facebook-page-probe-script.js";
import { downloadValidatedMedia } from "../runtime/media-download.js";
import {
  buildVideoDownloadFailure,
  buildVideoDownloadSuccess,
} from "../runtime/result.js";

type ParsedDownloadFacebookVideoInput = Extract<
  ParsedVideoDownloadAbilityInput,
  { childCapabilityId: "download-facebook-video-once" }
>;

const sameFacebookPage = (actual: string, expected: string): boolean => {
  const actualUrl = new URL(actual);
  const expectedUrl = new URL(expected);
  return actualUrl.host.endsWith("facebook.com")
    && expectedUrl.host.endsWith("facebook.com")
    && actualUrl.pathname === expectedUrl.pathname;
};

const firstVideoFact = (probe: ReturnType<typeof parseFacebookMediaProbe>) =>
  probe?.videoFacts.find((fact) => fact.duration || fact.width || fact.height) ?? null;

const asFailureMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown video download failure.";

type DownloadExecutionBase = {
  input: ParsedDownloadFacebookVideoInput;
  startedAt: string;
};

type CandidateDownloadContext = {
  base: DownloadExecutionBase;
  context: VideoDownloadExecutionContext;
  probe: NonNullable<ReturnType<typeof parseFacebookMediaProbe>>;
  abortSignal: AbortSignal;
};

type SuccessfulCandidateDownload = CandidateDownloadContext & {
  candidate: VideoDownloadCandidate;
  validation: Awaited<ReturnType<typeof validateFacebookMediaCandidate>> & { ok: true };
  downloaded: Awaited<ReturnType<typeof downloadValidatedMedia>> & { ok: true };
};

const probeActiveFacebookPage = async (
  context: VideoDownloadExecutionContext,
  abortSignal: AbortSignal,
): Promise<ReturnType<typeof parseFacebookMediaProbe>> =>
  parseFacebookMediaProbe(await context.browserMediaSourcePort.evaluateActiveTab({
    script: FACEBOOK_MEDIA_PROBE_SCRIPT,
    description: "collect Facebook video media candidates",
    abortSignal,
  }));

const selectCandidates = (
  base: DownloadExecutionBase,
  probe: NonNullable<ReturnType<typeof parseFacebookMediaProbe>>,
): VideoDownloadCandidate[] | VideoDownloadResult => {
  if (!sameFacebookPage(probe.pageUrl, base.input.sourcePageUrl)) {
    return buildVideoDownloadFailure(base, "source_page_mismatch", "Active Facebook page does not match requested source page.");
  }
  const candidates = normalizeFacebookCandidates(probe, base.input.preferredQuality);
  return candidates.length > 0
    ? candidates
    : buildVideoDownloadFailure(base, "candidate_not_found", "No MP4 Facebook media candidates were found.");
};

const writeDownloadedArtifact = (
  base: DownloadExecutionBase,
  context: VideoDownloadExecutionContext,
  probe: NonNullable<ReturnType<typeof parseFacebookMediaProbe>>,
  downloaded: Awaited<ReturnType<typeof downloadValidatedMedia>> & { ok: true },
) => context.artifactStoragePort.writeVideoArtifact({
  missionId: base.input.missionId,
  runId: base.input.runId,
  artifactId: `facebook_${probe.videoId ?? "unknown"}_${randomUUID()}`,
  extension: ".mp4",
  bytes: downloaded.bytes,
  contentType: downloaded.contentType,
  createdAt: new Date().toISOString(),
});

const successFromDownload = async (input: SuccessfulCandidateDownload): Promise<VideoDownloadResult> => {
  const artifact = await writeDownloadedArtifact(input.base, input.context, input.probe, input.downloaded);
  const fact = firstVideoFact(input.probe);
  return buildVideoDownloadSuccess({
    ...input.base,
    candidate: input.candidate,
    candidateHost: input.validation.host,
    contentType: input.downloaded.contentType,
    byteSize: input.downloaded.byteSize,
    durationMs: fact?.duration ? Math.round(fact.duration * 1000) : null,
    width: fact?.width ?? null,
    height: fact?.height ?? null,
    artifactRef: artifact.artifactRef,
    storageRef: artifact.storageRef,
    filePath: artifact.filePath,
    videoId: input.probe.videoId,
  });
};

async function tryCandidateDownload(
  input: CandidateDownloadContext,
  candidate: VideoDownloadCandidate,
): Promise<VideoDownloadResult | null> {
  const validation = await validateFacebookMediaCandidate(candidate, input.abortSignal);
  if (!validation.ok) return null;
  const downloaded = await downloadValidatedMedia(validation, input.base.input.maxBytes, input.abortSignal);
  return downloaded.ok ? successFromDownload({ ...input, candidate, validation, downloaded }) : null;
}

async function downloadFirstValidCandidate(input: CandidateDownloadContext & {
  candidates: VideoDownloadCandidate[];
}): Promise<VideoDownloadResult> {
  for (const candidate of input.candidates) {
    const result = await tryCandidateDownload(input, candidate);
    if (result) return result;
  }
  return buildVideoDownloadFailure(input.base, "candidate_not_video", "Facebook media candidates failed validation or download.");
}

async function executeDownloadFacebookVideoOnce(
  input: ParsedDownloadFacebookVideoInput,
  context: VideoDownloadExecutionContext,
): Promise<VideoDownloadResult> {
  const base = { input, startedAt: new Date().toISOString() };
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), input.timeoutMs);
  try {
    const probe = await probeActiveFacebookPage(context, abortController.signal);
    if (!probe) return buildVideoDownloadFailure(base, "candidate_not_found", "Facebook media probe returned no structured result.");
    const candidates = selectCandidates(base, probe);
    return Array.isArray(candidates)
      ? downloadFirstValidCandidate({ base, context, probe, candidates, abortSignal: abortController.signal })
      : candidates;
  } catch (error) {
    return buildVideoDownloadFailure(base, "network_failed", asFailureMessage(error));
  } finally {
    clearTimeout(timeout);
  }
}

export const downloadFacebookVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-facebook-video-once",
  execute: (input: ParsedVideoDownloadAbilityInput, context: VideoDownloadExecutionContext) =>
    executeDownloadFacebookVideoOnce(input as ParsedDownloadFacebookVideoInput, context),
};
