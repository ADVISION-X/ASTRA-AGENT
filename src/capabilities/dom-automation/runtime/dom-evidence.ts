import type { BrowserTargetSession } from "../../../lib/browser/browser-controller.js";

export async function captureDomEvidenceRef(
  browser: BrowserTargetSession,
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
