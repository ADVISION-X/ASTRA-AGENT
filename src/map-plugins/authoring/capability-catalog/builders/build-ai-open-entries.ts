import { listMapPluginAiChildren } from "./ai-capability-catalog-source.js";
import { listMapPluginOpenCatalogEntries } from "./open-capability-catalog-source.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildAiEntries = (): CapabilityCatalogEntry[] => {
  return listMapPluginAiChildren().map((childCapabilityId) =>
    buildEntry("ai", childCapabilityId, `Execute governed AI child ${humanize(childCapabilityId)} for governed tasks.`),
  );
};

const buildOpenEntries = (): CapabilityCatalogEntry[] => {
  return listMapPluginOpenCatalogEntries().map(({ childCapabilityId, child }) => {
    return buildEntry("open", childCapabilityId, child?.purpose ?? `Open governed target ${humanize(childCapabilityId)}.`, child ? [child.platformId] : undefined);
  });
};

export const buildAiOpenEntries = (): CapabilityCatalogEntry[] => [...buildAiEntries(), ...buildOpenEntries()];