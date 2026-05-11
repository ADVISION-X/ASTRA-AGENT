// Browser capture port — Screenshot uses this to capture raw browser viewport bytes.
// Screenshot does NOT call click/scroll/keyboard via this port.

export type BrowserCaptureResult = {
  /** Temp file path on disk containing the captured image bytes */
  filePath: string;
  mimeType: string;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type BrowserCaptureRegionInput = {
  regionLabel?: string;
  contentLines?: string[];
  abortSignal?: AbortSignal;
};

export interface BrowserCapturePort {
  captureViewport(input?: BrowserCaptureRegionInput): Promise<BrowserCaptureResult>;
}
