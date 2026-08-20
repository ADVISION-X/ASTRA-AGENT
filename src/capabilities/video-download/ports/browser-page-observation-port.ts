export type BrowserPageObservationRequest = Readonly<{
  sourcePageUrl: string;
  maxCandidates: number;
  abortSignal?: AbortSignal;
}>;

export type TelegramWebCacheObservationRequest = Readonly<{
  sourcePageUrl: string;
  maxBytes: number;
  telegramDocumentIdHash?: string;
  abortSignal?: AbortSignal;
}>;

/**
 * The only Browser-facing contract video-download may use. Each operation is
 * named, source-bound and bounded by its caller; no arbitrary page program is
 * accepted or forwarded through this capability.
 */
export interface BrowserPageObservationPort {
  observeUniversalVideoCandidates(input: BrowserPageObservationRequest): Promise<unknown>;
  observeFacebookVideoCandidates(input: BrowserPageObservationRequest): Promise<unknown>;
  observeTikTokVideoCandidates(input: BrowserPageObservationRequest): Promise<unknown>;
  observeTelegramWebCache(input: TelegramWebCacheObservationRequest): Promise<unknown>;
}
