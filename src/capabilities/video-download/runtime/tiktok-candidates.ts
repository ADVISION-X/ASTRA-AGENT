import {
  type VideoDownloadCandidate,
} from "../schema.js";
import { videoDownloadCandidateSchema } from "./candidate-schema.js";

type TikTokVideoFact = {
  width: number | null;
  height: number | null;
  duration: number | null;
};

type TikTokMediaProbe = {
  pageUrl: string;
  pageTitle: string;
  videoFact: TikTokVideoFact | null;
  candidates: unknown[];
};

export const parseTikTokMediaProbe = (value: unknown): TikTokMediaProbe | null => {
  if (!value || typeof value !== "object") return null;
  const probe = value as TikTokMediaProbe;
  if (typeof probe.pageUrl !== "string" || !Array.isArray(probe.candidates)) return null;
  return {
    pageUrl: probe.pageUrl,
    pageTitle: typeof probe.pageTitle === "string" ? probe.pageTitle : "",
    videoFact: probe.videoFact ?? null,
    candidates: probe.candidates,
  };
};

export const normalizeTikTokCandidates = (probe: TikTokMediaProbe): VideoDownloadCandidate[] => {
  const parsed = probe.candidates
    .map((c) => videoDownloadCandidateSchema.safeParse(c))
    .filter((r) => r.success)
    .map((r) => r.data);
  // native_hd from page data always takes priority
  return parsed.sort((a, b) => {
    if (a.kind === "native_hd" && b.kind !== "native_hd") return -1;
    if (b.kind === "native_hd" && a.kind !== "native_hd") return 1;
    return 0;
  });
};
