import type {
  PageStateChildCapabilityId,
} from "./contract.js";
import { PAGE_STATE_CHILD_CAPABILITY_IDS } from "./schema.js";
import type { PageStateChildCapability } from "./runtime/page-state-child-contract.js";
import { createObservePageSurfaceCapability } from "./children/page-state-observation-child.js";

export function createPageStateRegistry(): Map<PageStateChildCapabilityId, PageStateChildCapability> {
  return new Map<PageStateChildCapabilityId, PageStateChildCapability>(
    PAGE_STATE_CHILD_CAPABILITY_IDS.map((childCapabilityId) => [
      childCapabilityId,
      createObservePageSurfaceCapability(childCapabilityId),
    ]),
  );
}

export function listPageStateChildren(): PageStateChildCapabilityId[] {
  return [...PAGE_STATE_CHILD_CAPABILITY_IDS];
}