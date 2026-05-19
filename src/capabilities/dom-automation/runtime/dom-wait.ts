import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { WaitForDomStateInputSchema } from "../schema.js";
import type { DomVerificationResult, WaitForDomStateInput } from "../schema.js";
import { readDomSnapshotOnce } from "./dom-snapshot.js";
import { verifyDomStateOnce } from "./dom-verify.js";

export async function waitForDomStateOnce(
  browser: BrowserController,
  rawInput: WaitForDomStateInput,
): Promise<DomVerificationResult> {
  const input = WaitForDomStateInputSchema.parse(rawInput);
  const startedAt = Date.now();
  let snapshot = input.initialSnapshot ?? await readDomSnapshotOnce(browser);
  const verifyInput = {
    expectedStates: input.expectedStates,
    successHints: input.successHints,
    failureHints: input.failureHints,
  };
  let latest = verifyDomStateOnce({ ...verifyInput, snapshot });
  while (latest.status === "not_found" && Date.now() - startedAt < input.timeoutMs) {
    await browser.wait(input.pollIntervalMs);
    snapshot = await readDomSnapshotOnce(browser);
    latest = verifyDomStateOnce({ ...verifyInput, snapshot });
  }
  return latest;
}
