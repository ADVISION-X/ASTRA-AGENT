import { listGeometryGuardChildren } from "../../../../capabilities/geometry-guard/registry.js";
import { listMouseClickChildren } from "../../../../capabilities/mouse-click/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildGeometryGuardEntries = (): CapabilityCatalogEntry[] =>
  listGeometryGuardChildren().map((childCapabilityId) =>
    buildEntry("geometry-guard", childCapabilityId, `Normalize or validate governed geometry for ${humanize(childCapabilityId)}.`),
  );

const buildMouseClickEntries = (): CapabilityCatalogEntry[] =>
  listMouseClickChildren().map((childCapabilityId) =>
    buildEntry("mouse-click", childCapabilityId, `Execute governed click behavior for ${humanize(childCapabilityId)}.`),
  );

export const buildGeometryActionEntries = (): CapabilityCatalogEntry[] => [
  ...buildGeometryGuardEntries(),
  ...buildMouseClickEntries(),
];