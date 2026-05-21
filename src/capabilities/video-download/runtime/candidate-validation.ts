import type {
  VideoDownloadCandidate,
} from "../schema.js";
import type { VideoDownloadFailureReason } from "../type-contracts.js";

export type CandidateValidationSuccess = {
  ok: true;
  candidate: VideoDownloadCandidate;
  contentType: string;
  contentLength: number | null;
  contentRange: string | null;
  firstBytes: Uint8Array;
  host: string;
};

export type CandidateValidationFailure = {
  ok: false;
  failureReason: VideoDownloadFailureReason;
  reason: string;
};

export type CandidateValidationResult =
  | CandidateValidationSuccess
  | CandidateValidationFailure;

const isAllowedFacebookMediaHost = (host: string): boolean =>
  /^video\.[a-z0-9.-]+\.fbcdn\.net$/iu.test(host)
  || /^scontent\.[a-z0-9-]+(?:\.[a-z0-9-]+)*\.fbcdn\.net$/iu.test(host);

const parseContentRangeTotal = (contentRange: string | null): number | null => {
  const matched = contentRange?.match(/\/(\d+)$/u);
  return matched ? Number.parseInt(matched[1] ?? "", 10) : null;
};

const isMp4Header = (bytes: Uint8Array): boolean => {
  const text = new TextDecoder("ascii").decode(bytes.slice(4, 12));
  return text.includes("ftyp");
};

const buildHeaders = (): HeadersInit => ({
  Range: "bytes=0-1023",
  "User-Agent": "Mozilla/5.0",
});

export const validateFacebookMediaCandidate = async (
  candidate: VideoDownloadCandidate,
  abortSignal?: AbortSignal,
): Promise<CandidateValidationResult> => {
  const url = new URL(candidate.url);
  if (!isAllowedFacebookMediaHost(url.host)) {
    return { ok: false, failureReason: "candidate_host_forbidden", reason: "Media host is outside Facebook CDN allowlist." };
  }
  const requestInit: RequestInit = { headers: buildHeaders() };
  if (abortSignal) requestInit.signal = abortSignal;
  const response = await fetch(candidate.url, requestInit);
  if (response.status !== 200 && response.status !== 206) {
    return { ok: false, failureReason: "download_expired", reason: `Media candidate returned HTTP ${response.status}.` };
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("video/mp4")) {
    return { ok: false, failureReason: "candidate_not_video", reason: `Candidate MIME is ${contentType || "missing"}.` };
  }
  const firstBytes = new Uint8Array(await response.arrayBuffer());
  if (!isMp4Header(firstBytes)) {
    return { ok: false, failureReason: "metadata_validation_failed", reason: "Candidate does not expose an MP4 ftyp header." };
  }
  return {
    ok: true,
    candidate,
    contentType,
    contentLength: parseContentRangeTotal(response.headers.get("content-range")),
    contentRange: response.headers.get("content-range"),
    firstBytes,
    host: url.host,
  };
};
