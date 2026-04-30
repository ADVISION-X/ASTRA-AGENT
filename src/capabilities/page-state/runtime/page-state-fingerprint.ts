import { createHash } from "node:crypto";

import type { PageStateAbilityInput, PageStateType } from "../schema.js";

export function createPageStateFingerprint(input: {
  request: PageStateAbilityInput;
  pageStateType: PageStateType;
  observationRefs: readonly string[];
}): string {
  const payload = {
    childCapabilityId: input.request.childCapabilityId,
    snapshotId: input.request.snapshot.snapshotId,
    snapshotProofRef: input.request.snapshot.sourceProofRef,
    currentUrl: input.request.snapshot.currentUrl,
    currentTitle: input.request.snapshot.currentTitle,
    browserLoginState: input.request.snapshot.browserLoginState,
    viewport: input.request.snapshot.viewport,
    scrollOffset: input.request.snapshot.scrollOffset,
    sourceEvidenceRefs: [...input.request.sourceEvidenceRefs].sort(),
    openProofRef: input.request.openHandoff.openProofRef,
    browserSessionRef: input.request.openHandoff.browserSessionRef,
    platformProfileId: input.request.openHandoff.platformProfileId,
    confidencePolicy: input.request.confidencePolicy,
    freshnessPolicy: input.request.freshnessPolicy,
    statePolicy: input.request.statePolicy,
    pageStateType: input.pageStateType,
    observationRefs: [...input.observationRefs].sort(),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}