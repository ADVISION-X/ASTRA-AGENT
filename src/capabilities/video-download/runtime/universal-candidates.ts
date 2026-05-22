import {
  type VideoDownloadCandidate,
} from "../schema.js";
import {
  type VideoDownloadCandidateKind,
  videoDownloadCandidateSchema,
} from "./candidate-schema.js";

type UniversalProbeResult = {
  pageUrl: string;
  pageTitle: string;
  candidates: unknown[];
};

const KIND_RANK: Record<VideoDownloadCandidateKind, number> = {
  native_hd: 0,
  video_element: 1,
  media_resource: 2,
  hls_manifest: 3,
  dash_manifest: 4,
  source_element: 5,
  native_sd: 6,
};

const candidateRank = (c: VideoDownloadCandidate): number =>
  KIND_RANK[c.kind] ?? 99;

export const parseUniversalProbeResult = (value: unknown): UniversalProbeResult | null => {
  if (!value || typeof value !== "object") return null;
  const probe = value as UniversalProbeResult;
  if (typeof probe.pageUrl !== "string" || !Array.isArray(probe.candidates)) return null;
  return {
    pageUrl: probe.pageUrl,
    pageTitle: typeof probe.pageTitle === "string" ? probe.pageTitle : "",
    candidates: probe.candidates,
  };
};

export const normalizeUniversalCandidates = (
  probe: UniversalProbeResult,
): VideoDownloadCandidate[] => {
  const parsed = probe.candidates
    .map((c) => videoDownloadCandidateSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => r.data);
  return parsed.sort((a, b) => candidateRank(a) - candidateRank(b));
};
