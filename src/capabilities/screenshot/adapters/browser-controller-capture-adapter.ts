import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import type { BrowserCapturePort } from "../ports/browser-capture-port.js";

export function createBrowserControllerCapturePort(browserController: BrowserController): BrowserCapturePort {
  return {
    async captureViewport(input) {
      const capture = await browserController.screenshotRegion({
        regionLabel: input?.regionLabel ?? "viewport",
        ...(input?.contentLines ? { contentLines: input.contentLines } : {}),
        ...(input?.abortSignal ? { abortSignal: input.abortSignal } : {}),
      });

      return {
        filePath: capture.sourceFilePath,
        mimeType: "image/png",
        width: capture.width,
        height: capture.height,
        viewportWidth: capture.viewportWidth,
        viewportHeight: capture.viewportHeight,
      };
    },
  };
}
