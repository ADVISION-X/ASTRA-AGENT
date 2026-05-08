import { listPostActionVerificationChildren } from "../../../../capabilities/post-action-verification/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

export const buildPostActionEntries = (): CapabilityCatalogEntry[] => [
  ...listPostActionVerificationChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "post-action-verification",
      childCapabilityId,
      description: childCapabilityId === "verify-action-result"
        ? "Verify governed post-action result for map-routable action steps."
        : `Verify governed post-action outcome for ${humanize(childCapabilityId)}.`,
    }),
  ),
];
