import { listMouseScrollChildren } from "../../../../capabilities/mouse-scroll/registry.js";
import { listTextInputChildren } from "../../../../capabilities/text-input/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildTextInputEntries = (): CapabilityCatalogEntry[] =>
  listTextInputChildren().map((childCapabilityId) =>
    buildEntry("text-input", childCapabilityId, `Execute governed text-input behavior for ${humanize(childCapabilityId)}.`),
  );

const buildMouseScrollEntries = (): CapabilityCatalogEntry[] =>
  listMouseScrollChildren().map((childCapabilityId) =>
    buildEntry("mouse-scroll", childCapabilityId, `Execute governed scroll behavior for ${humanize(childCapabilityId)}.`),
  );

export const buildInputScrollEntries = (): CapabilityCatalogEntry[] => [
  ...buildTextInputEntries(),
  ...buildMouseScrollEntries(),
];