import {
  type VideoDownloadCandidate,
} from "../schema.js";
import { videoDownloadCandidateSchema } from "./candidate-schema.js";

type FacebookProbeResult = {
  pageUrl: string;
  pageTitle: string;
  videoId: string | null;
  videoFacts: Array<{
    duration: number | null;
    width: number | null;
    height: number | null;
    readyState: number;
  }>;
  candidates: unknown[];
};

export type FacebookMediaProbe = FacebookProbeResult;

const candidateRank = (candidate: VideoDownloadCandidate): number => {
  if (candidate.kind === "native_hd") return 0;
  if (candidate.kind === "native_sd") return 1;
  if (candidate.kind === "video_element") return 2;
  if (candidate.kind === "media_resource") return 3;
  return 4;
};

export const parseFacebookMediaProbe = (value: unknown): FacebookMediaProbe | null => {
  if (!value || typeof value !== "object") return null;
  const probe = value as FacebookProbeResult;
  if (typeof probe.pageUrl !== "string" || !Array.isArray(probe.candidates)) {
    return null;
  }
  return {
    pageUrl: probe.pageUrl,
    pageTitle: typeof probe.pageTitle === "string" ? probe.pageTitle : "",
    videoId: typeof probe.videoId === "string" ? probe.videoId : null,
    videoFacts: Array.isArray(probe.videoFacts) ? probe.videoFacts : [],
    candidates: probe.candidates,
  };
};

export const normalizeFacebookCandidates = (
  probe: FacebookMediaProbe,
  preferredQuality: "hd" | "sd" | "best_available",
): VideoDownloadCandidate[] => {
  const parsed = probe.candidates
    .map((candidate) => videoDownloadCandidateSchema.safeParse(candidate))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter((candidate) => candidate.url.includes(".mp4"));
  const quality = preferredQuality === "best_available" ? null : preferredQuality;
  return parsed
    .filter((candidate) => quality === null || candidate.quality === quality)
    .sort((left, right) => candidateRank(left) - candidateRank(right));
};
