import assert from "node:assert/strict";

import { clickDomElementOnce } from "../../src/capabilities/dom-automation/index.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "../../src/types/browser-target.js";

const targetRef = (value: string): BrowserTargetRef => value as BrowserTargetRef;
const documentRef = (value: string): BrowserDocumentRef => value as BrowserDocumentRef;
const browser = { getTarget: () => ({ targetRef: targetRef("bt_a"), documentRef: documentRef("bd_2") }) } as never;
const clickInput = (target: BrowserTargetRef, document: BrowserDocumentRef) => ({
  elementRef: {
    targetRef: target,
    documentRef: document,
    elementRef: "fixture-button",
    selector: "button",
    targetKind: "button" as const,
    confidence: 1,
    matchedSignals: ["fixture"],
    reason: "fixture",
    fallbackUsed: false,
  },
  expectedKind: "button",
});
await assert.rejects(
  clickDomElementOnce(browser, clickInput(targetRef("bt_b"), documentRef("bd_2"))),
  /TARGET_FOREIGN_SESSION/u,
);
await assert.rejects(
  clickDomElementOnce(browser, clickInput(targetRef("bt_a"), documentRef("bd_1"))),
  /DOCUMENT_STALE/u,
);
process.stdout.write("[dom-automation-exact-target] PASS\n");
