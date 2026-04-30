import { execFile } from "node:child_process";

import sharp from "sharp";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { ScreenshotBrowserCaptureSchema, ScreenshotBrowserSessionSnapshotSchema, ScreenshotDesktopCaptureSchema } from "../schema.js";
import { SCREENSHOT_CAPTURE_PORT_KIND } from "../shared/screenshot-result.js";

function runAbortableExecFile(command: string, args: string[], signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, signal ? { signal } : undefined, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });

    child.once("error", reject);
  });
}

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
    abortSignal?: AbortSignal;
  }): Promise<ScreenshotCapturePortBrowserCapture>;
  captureDesktopScreen(input: {
    screenId: string;
    outputPath: string;
    createdAt: string;
    abortSignal?: AbortSignal;
  }): Promise<ScreenshotCapturePortDesktopCapture>;
}

async function readImageSize(filePath: string): Promise<{ width: number; height: number }> {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Desktop capture produced unreadable dimensions for ${filePath}.`);
  }
  return { width: metadata.width, height: metadata.height };
}

export function createBrowserControllerScreenshotCapturePort(browserController: BrowserController): ScreenshotCapturePort {
  return {
    portKind: SCREENSHOT_CAPTURE_PORT_KIND,
    async getBrowserSessionSnapshot() {
      return ScreenshotBrowserSessionSnapshotSchema.parse(browserController.getSessionState());
    },
    async captureBrowserViewport(input) {
      const capture = await browserController.screenshotRegion({
        regionLabel: input.regionLabel,
        contentLines: input.contentLines,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });
      return {
        kind: "browser",
        capture: ScreenshotBrowserCaptureSchema.parse({
          ...capture,
          contentLines: capture.contentLines ?? [],
        }),
      };
    },
    async captureDesktopScreen(input) {
      await runAbortableExecFile("screencapture", ["-x", input.outputPath], input.abortSignal);
      const dimensions = await readImageSize(input.outputPath);
      return {
        kind: "desktop",
        capture: ScreenshotDesktopCaptureSchema.parse({
          screenId: input.screenId,
          width: dimensions.width,
          height: dimensions.height,
          sourceFilePath: input.outputPath,
          createdAt: input.createdAt,
        }),
      };
    },
  };
}
