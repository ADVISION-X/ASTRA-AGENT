import type { BrowserCaptureResult, BrowserController } from "./browser-controller.js";

export class ScreenCaptureController {
  constructor(private readonly browserController: BrowserController) {}

  async captureBrowserRegion(input: {
    regionLabel: string;
    contentLines?: string[];
  }): Promise<BrowserCaptureResult> {
    return this.browserController.screenshotRegion(input);
  }
}