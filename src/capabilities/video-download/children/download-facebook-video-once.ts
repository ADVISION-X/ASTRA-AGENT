import { randomUUID } from "node:crypto";

import type {
  VideoDownloadChildCapability,
  VideoDownloadExecutionContext,
} from "../contract.js";
import type {
  ParsedDownloadFacebookVideoInput,
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

const sameFacebookPage = (actual: string, expected: string): boolean => {
  const actualUrl = new URL(actual);
  const expectedUrl = new URL(expected);
  return actualUrl.host.endsWith("facebook.com")
    && expectedUrl.host.endsWith("facebook.com")
    && actualUrl.pathname === expectedUrl.pathname;
};

const firstVideoFact = (probe: ReturnType<typeof parseFacebookMediaProbe>) =>
  probe?.videoFacts.find((fact) => fact.duration || fact.width || fact.height) ?? null;

export const downloadFacebookVideoOnce: VideoDownloadChildCapability = {
  abilityGroupId: "video-download",
  childCapabilityId: "download-facebook-video-once",

  async execute(
    input: ParsedDownloadFacebookVideoInput,
    context: VideoDownloadExecutionContext,
  ): Promise<VideoDownloadResult> {
    const startedAt = new Date().toISOString();
    const base = { input, startedAt };
    const probe = parseFacebookMediaProbe(await context.browserMediaSourcePort.evaluateActiveTab({
      script: FACEBOOK_MEDIA_PROBE_SCRIPT,
      description: "collect Facebook video media candidates",
    }));
    if (!probe) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "Facebook media probe returned no structured result.");
    }
    if (!sameFacebookPage(probe.pageUrl, input.sourcePageUrl)) {
      return buildVideoDownloadFailure(base, "source_page_mismatch", "Active Facebook page does not match requested source page.");
    }
    const candidates = normalizeFacebookCandidates(probe, input.preferredQuality);
    if (candidates.length === 0) {
      return buildVideoDownloadFailure(base, "candidate_not_found", "No MP4 Facebook media candidates were found.");
    }
    for (const candidate of candidates) {
      const validation = await validateFacebookMediaCandidate(candidate);
      if (!validation.ok) continue;
      const downloaded = await downloadValidatedMedia(validation, input.maxBytes);
      if (!downloaded.ok) continue;
      const artifact = await context.artifactStoragePort.writeVideoArtifact({
        missionId: input.missionId,
        runId: input.runId,
        artifactId: `facebook_${probe.videoId ?? "unknown"}_${randomUUID()}`,
        extension: ".mp4",
        bytes: downloaded.bytes,
        contentType: downloaded.contentType,
        createdAt: new Date().toISOString(),
      });
      const fact = firstVideoFact(probe);
      return buildVideoDownloadSuccess({
        ...base,
        candidate,
        candidateHost: validation.host,
        contentType: downloaded.contentType,
        byteSize: downloaded.byteSize,
        durationMs: fact?.duration ? Math.round(fact.duration * 1000) : null,
        width: fact?.width ?? null,
        height: fact?.height ?? null,
        artifactRef: artifact.artifactRef,
        storageRef: artifact.storageRef,
        filePath: artifact.filePath,
        videoId: probe.videoId,
      });
    }
    return buildVideoDownloadFailure(base, "candidate_not_video", "Facebook media candidates failed validation or download.");
  },
};
