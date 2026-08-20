import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";

export async function captureDomEvidenceRef(
  browser: BrowserTargetLease,
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
