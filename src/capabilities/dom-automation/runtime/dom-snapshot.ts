import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomSnapshot } from "../../../types/dom-automation.js";
import type { ReadDomSnapshotInput } from "../../../types/dom-automation-inputs.js";

export async function readDomSnapshotOnce(
  browser: BrowserTargetLease,
  input: ReadDomSnapshotInput = {},
  options?: { abortSignal?: AbortSignal },
): Promise<DomSnapshot> {
  const parsed = DOM_SCHEMAS.ReadDomSnapshotInput.parse(input);
  const raw = await browser.observeCapability({
    capabilityId: "dom.snapshot.structural.v1",
    ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {}),
    ...(parsed.timeoutMs ? { timeoutMs: parsed.timeoutMs } : {}),
  });
  return DOM_SCHEMAS.DomSnapshot.parse({
    ...(raw as Record<string, unknown>),
    targetRef: browser.target.targetRef,
    documentRef: browser.document.documentRef,
  }) as DomSnapshot;
}
