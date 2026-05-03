import { listPostActionVerificationChildren } from "../../../../capabilities/post-action-verification/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const MAP_PLUGIN_POST_ACTION_ALIAS_CHILDREN = ["verify-action-result"] as const;

export const buildPostActionEntries = (): CapabilityCatalogEntry[] => [
  ...listPostActionVerificationChildren().map((childCapabilityId) =>
    buildEntry("post-action-verification", childCapabilityId, `Verify governed post-action outcome for ${humanize(childCapabilityId)}.`),
  ),
  ...MAP_PLUGIN_POST_ACTION_ALIAS_CHILDREN.map((childCapabilityId) =>
    buildEntry("post-action-verification", childCapabilityId, "Verify governed post-action result for map-routable action steps."),
  ),
];