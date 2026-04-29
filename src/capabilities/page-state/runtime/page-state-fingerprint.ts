import { createHash } from "node:crypto";

import type { PageStateAbilityInput, PageStateType } from "../schema.js";

export function createPageStateFingerprint(input: {
  request: PageStateAbilityInput;
  pageStateType: PageStateType;
  observationRefs: readonly string[];
}): string {
  const payload = {
    snapshotId: input.request.snapshot.snapshotId,
    currentUrl: input.request.snapshot.currentUrl,
    currentTitle: input.request.snapshot.currentTitle,
    browserLoginState: input.request.snapshot.browserLoginState,
    viewport: input.request.snapshot.viewport,
    scrollOffset: input.request.snapshot.scrollOffset,
    pageStateType: input.pageStateType,
    observationRefs: [...input.observationRefs].sort(),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}