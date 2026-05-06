import { listForensicsPersistenceChildren } from "../../../../capabilities/forensics-persistence/registry.js";
import { listPageStateChildren } from "../../../../capabilities/page-state/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildForensicsEntries = (): CapabilityCatalogEntry[] =>
  listForensicsPersistenceChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "forensics-persistence",
      childCapabilityId,
      description: `Persist governed forensic record for ${humanize(childCapabilityId)}.`,
    }),
  );

const buildPageStateEntries = (): CapabilityCatalogEntry[] =>
  listPageStateChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "page-state",
      childCapabilityId,
      description: `Classify governed page state for ${humanize(childCapabilityId)}.`,
    }),
  );

export const buildForensicsPageStateEntries = (): CapabilityCatalogEntry[] => [
  ...buildForensicsEntries(),
  ...buildPageStateEntries(),
];
