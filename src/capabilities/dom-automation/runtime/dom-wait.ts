import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomVerificationResult } from "../../../types/dom-automation.js";
import type { VerifyDomStateInput, WaitForDomStateInput } from "../../../types/dom-automation-inputs.js";
import { readDomSnapshotOnce } from "./dom-snapshot.js";
import { verifyDomStateOnce } from "./dom-verify.js";

export async function waitForDomStateOnce(
  browser: BrowserController,
  rawInput: WaitForDomStateInput,
): Promise<DomVerificationResult> {
  const input = DOM_SCHEMAS.WaitForDomStateInput.parse(rawInput) as WaitForDomStateInput;
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? 5000;
  const pollIntervalMs = input.pollIntervalMs ?? 500;
  let snapshot = input.initialSnapshot ?? await readDomSnapshotOnce(browser);
  const verifyInput = {
    expectedStates: input.expectedStates,
    successHints: input.successHints,
    failureHints: input.failureHints,
  };
  let latest = verifyDomStateOnce({ ...verifyInput, snapshot } as VerifyDomStateInput);
  while (latest.status === "not_found" && Date.now() - startedAt < timeoutMs) {
    await browser.wait(pollIntervalMs);
    snapshot = await readDomSnapshotOnce(browser);
    latest = verifyDomStateOnce({ ...verifyInput, snapshot } as VerifyDomStateInput);
  }
  return latest;
}
