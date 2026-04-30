import { listPostActionVerificationChildren } from "../../../../capabilities/post-action-verification/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

export const buildPostActionEntries = (): CapabilityCatalogEntry[] =>
  listPostActionVerificationChildren().map((childCapabilityId) =>
    buildEntry("post-action-verification", childCapabilityId, `Verify governed post-action outcome for ${humanize(childCapabilityId)}.`),
  );