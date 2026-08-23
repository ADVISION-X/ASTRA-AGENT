export type VideoDownloadAbortHandle = {
  readonly signal: AbortSignal;
  dispose(): void;
};

export const createVideoDownloadAbortHandle = (
  timeoutMs: number,
  parentSignal?: AbortSignal,
): VideoDownloadAbortHandle => {
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abort();
  else parentSignal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("video_download_timeout")), timeoutMs);
  timeout.unref();
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abort);
    },
  };
};
