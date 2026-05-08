import { listMapPluginMouseScrollChildren } from "./mouse-scroll-capability-catalog-source.js";
import { listMapPluginTextInputChildren } from "./text-input-capability-catalog-source.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildTextInputEntries = (): CapabilityCatalogEntry[] =>
  listMapPluginTextInputChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "text-input",
      childCapabilityId,
      description: `Execute governed text-input behavior for ${humanize(childCapabilityId)}.`,
      ...(childCapabilityId === "press-navigation-key"
        ? {
          metadata: {
            targetKind: "feed_surface",
            requiresGeometryProof: false,
          },
        }
        : {}),
    }),
  );

const buildMouseScrollEntries = (): CapabilityCatalogEntry[] =>
  listMapPluginMouseScrollChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "mouse-scroll",
      childCapabilityId,
      description: `Execute governed scroll behavior for ${humanize(childCapabilityId)}.`,
    }),
  );

export const buildInputScrollEntries = (): CapabilityCatalogEntry[] => [
  ...buildTextInputEntries(),
  ...buildMouseScrollEntries(),
];
