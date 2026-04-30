import { createAiCapabilityRegistry, listAiChildren } from "../../../../capabilities/ai/registry.js";
import { createOpenRegistry, listOpenChildren } from "../../../../capabilities/open/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildAiEntries = (): CapabilityCatalogEntry[] => {
  const registry = createAiCapabilityRegistry();
  return listAiChildren().map((childCapabilityId) => {
    const child = registry.get(childCapabilityId);
    const allowedTaskTypes = child ? child.allowedTaskTypes.join(", ") : "governed tasks";
    return buildEntry("ai", childCapabilityId, `Execute governed AI child ${humanize(childCapabilityId)} for task types: ${allowedTaskTypes}.`);
  });
};

const buildOpenEntries = (): CapabilityCatalogEntry[] => {
  const registry = createOpenRegistry();
  return listOpenChildren().map((childCapabilityId) => {
    const child = registry.get(childCapabilityId);
    return buildEntry("open", childCapabilityId, child?.purpose ?? `Open governed target ${humanize(childCapabilityId)}.`, child ? [child.platformId] : undefined);
  });
};

export const buildAiOpenEntries = (): CapabilityCatalogEntry[] => [...buildAiEntries(), ...buildOpenEntries()];