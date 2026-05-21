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

const buildMediaDownloadFailure = (reason: string): MediaDownloadFailure => ({ ok: false, reason });

const isMp4Container = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12) {
    return false;
  }
  const text = new TextDecoder("ascii").decode(bytes.slice(4, 12));
  return text.includes("ftyp");
};

const readValidatedMediaResponse = async (input: {
  validation: CandidateValidationSuccess;
  abortSignal?: AbortSignal;
}): Promise<
  | MediaDownloadFailure
  | {
      ok: true;
      contentType: string;
      bytes: Uint8Array;
    }
> => {
  const requestInit: RequestInit = { headers: buildDownloadHeaders() };
  if (input.abortSignal) {
    requestInit.signal = input.abortSignal;
  }
  const response = await fetch(input.validation.candidate.url, requestInit);
  if (!response.ok) {
    return buildMediaDownloadFailure(`Media download returned HTTP ${response.status}.`);
  }
  return {
    ok: true,
    contentType: response.headers.get("content-type") ?? input.validation.contentType,
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
};

const validateDownloadedMediaPayload = (input: {
  contentType: string;
  bytes: Uint8Array;
  maxBytes: number;
}): MediaDownloadResult => {
  if (input.bytes.length === 0) {
    return buildMediaDownloadFailure("Media download produced an empty file.");
  }
  if (input.bytes.length > input.maxBytes) {
    return buildMediaDownloadFailure(`Media download exceeded maxBytes ${input.maxBytes}.`);
  }
  if (!input.contentType.toLowerCase().includes("video/")) {
    return buildMediaDownloadFailure(`Media download MIME is ${input.contentType}.`);
  }
  if (!isMp4Container(input.bytes)) {
    return buildMediaDownloadFailure("Media download is not a valid MP4 container.");
  }
  return {
    ok: true,
    bytes: input.bytes,
    contentType: input.contentType,
    byteSize: input.bytes.length,
  };
};

export const downloadValidatedMedia = async (
  validation: CandidateValidationSuccess,
  maxBytes: number,
  abortSignal?: AbortSignal,
): Promise<MediaDownloadResult> => {
  const response = await readValidatedMediaResponse({
    validation,
    ...(abortSignal ? { abortSignal } : {}),
  });
  if (!response.ok) {
    return response;
  }
  return validateDownloadedMediaPayload({
    contentType: response.contentType,
    bytes: response.bytes,
    maxBytes,
  });
};
