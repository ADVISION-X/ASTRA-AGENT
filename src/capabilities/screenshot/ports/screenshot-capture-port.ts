import { ScreenshotBrowserCaptureSchema, ScreenshotBrowserSessionSnapshotSchema, ScreenshotDesktopCaptureSchema } from "../schema.js";

export type ScreenshotBrowserViewportCaptureProfile = "default" | "observation_lightweight";

export type ScreenshotCapturePortBrowserCapture = {
  kind: "browser";
  capture: ReturnType<typeof ScreenshotBrowserCaptureSchema.parse>;
};

export type ScreenshotCapturePortDesktopCapture = {
  kind: "desktop";
  capture: ReturnType<typeof ScreenshotDesktopCaptureSchema.parse>;
};

export interface ScreenshotCapturePort {
  readonly portKind: "browser-controller-screenshot-capture-port";
  getBrowserSessionSnapshot(): Promise<ReturnType<typeof ScreenshotBrowserSessionSnapshotSchema.parse>>;
  captureBrowserViewport(input: {
    regionLabel: string;
    contentLines: string[];
    captureProfile?: ScreenshotBrowserViewportCaptureProfile;
    abortSignal?: AbortSignal;
  }): Promise<ScreenshotCapturePortBrowserCapture>;
  captureDesktopScreen(input: {
    screenId: string;
    outputPath: string;
    createdAt: string;
    abortSignal?: AbortSignal;
  }): Promise<ScreenshotCapturePortDesktopCapture>;
}
