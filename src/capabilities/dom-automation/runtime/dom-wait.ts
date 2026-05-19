import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { WaitForDomStateInputSchema } from "../schema.js";
import type { DomVerificationResult, WaitForDomStateInput } from "../schema.js";
import { verifyDomStateOnce } from "./dom-verify.js";

export async function waitForDomStateOnce(
  browser: BrowserController,
  rawInput: WaitForDomStateInput,
): Promise<DomVerificationResult> {
  const input = WaitForDomStateInputSchema.parse(rawInput);
  const startedAt = Date.now();
  let latest = verifyDomStateOnce(input);
  while (latest.status === "not_found" && Date.now() - startedAt < input.timeoutMs) {
    await browser.wait(input.pollIntervalMs);
    latest = verifyDomStateOnce(input);
  }
  return latest;
}
