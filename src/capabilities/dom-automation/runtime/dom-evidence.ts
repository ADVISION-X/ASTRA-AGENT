import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";

export async function captureDomEvidenceRef(
  browser: BrowserTargetLease,
  regionLabel: string,
): Promise<string | null> {
  try {
    const capture = await browser.captureScreenshot({ regionLabel });
    return capture.artifactRef;
  } catch {
    return null;
  }
}
