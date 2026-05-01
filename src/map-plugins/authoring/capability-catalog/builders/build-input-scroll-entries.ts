import { listMapPluginMouseScrollChildren } from "./mouse-scroll-capability-catalog-source.js";
import { listMapPluginTextInputChildren } from "./text-input-capability-catalog-source.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildTextInputEntries = (): CapabilityCatalogEntry[] =>
  listMapPluginTextInputChildren().map((childCapabilityId) =>
    buildEntry("text-input", childCapabilityId, `Execute governed text-input behavior for ${humanize(childCapabilityId)}.`),
  );

const buildMouseScrollEntries = (): CapabilityCatalogEntry[] =>
  listMapPluginMouseScrollChildren().map((childCapabilityId) =>
    buildEntry("mouse-scroll", childCapabilityId, `Execute governed scroll behavior for ${humanize(childCapabilityId)}.`),
  );

export const buildInputScrollEntries = (): CapabilityCatalogEntry[] => [
  ...buildTextInputEntries(),
  ...buildMouseScrollEntries(),
];