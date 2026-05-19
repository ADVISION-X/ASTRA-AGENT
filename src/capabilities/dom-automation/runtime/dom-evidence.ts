import type { BrowserController } from "../../../lib/browser/browser-controller.js";

export async function captureDomEvidenceRef(
  browser: BrowserController,
  regionLabel: string,
): Promise<string | null> {
  try {
    const capture = await browser.screenshotRegion({
      regionLabel,
      captureProfile: "observation_lightweight",
    });
    return capture.sourceFilePath || capture.browserActionId;
  } catch {
    return null;
  }
}
