import type { CandidateValidationSuccess } from "./candidate-validation.js";

export type MediaDownloadSuccess = {
  ok: true;
  bytes: Uint8Array;
  contentType: string;
  byteSize: number;
};

export type MediaDownloadFailure = {
  ok: false;
  reason: string;
};

export type MediaDownloadResult = MediaDownloadSuccess | MediaDownloadFailure;

const buildDownloadHeaders = (): HeadersInit => ({
  "User-Agent": "Mozilla/5.0",
});

export const downloadValidatedMedia = async (
  validation: CandidateValidationSuccess,
  maxBytes: number,
): Promise<MediaDownloadResult> => {
  const response = await fetch(validation.candidate.url, {
    headers: buildDownloadHeaders(),
  });
  if (!response.ok) {
    return { ok: false, reason: `Media download returned HTTP ${response.status}.` };
  }
  const contentType = response.headers.get("content-type") ?? validation.contentType;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    return { ok: false, reason: `Media download exceeded maxBytes ${maxBytes}.` };
  }
  if (!contentType.toLowerCase().includes("video/mp4")) {
    return { ok: false, reason: `Media download MIME is ${contentType}.` };
  }
  return {
    ok: true,
    bytes,
    contentType,
    byteSize: bytes.length,
  };
};
