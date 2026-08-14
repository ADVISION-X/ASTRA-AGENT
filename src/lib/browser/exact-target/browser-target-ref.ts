import type { BrowserDocumentRef, BrowserTargetRef } from "../../../types/browser-target.js";

export type { BrowserDocumentRef, BrowserTargetRef } from "../../../types/browser-target.js";

export interface ControlledBrowserTarget {
  readonly targetRef: BrowserTargetRef;
  readonly documentRef: BrowserDocumentRef;
  readonly url: string;
  readonly title: string;
  readonly origin: string;
  readonly lifecycle: "attached" | "detached" | "closed";
  readonly acquiredAt: string;
}
