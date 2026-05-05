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
    const isLocalProgram = child?.targetKind === "local-program";
    const metadata = child ? {
      platformId: child.platformId,
      targetKind: child.targetKind,
      requiresPostOpenWindowHandoff: isLocalProgram,
      ...(isLocalProgram ? {
        forbiddenResponsibilities: [
          "click inside app",
          "type inside app",
          "screenshot app internally",
          "decide internal app state",
          "execute arbitrary shell command",
          "bypass visual chain",
        ],
      } : {}),
    } : undefined;
    return buildEntry(
      "open",
      childCapabilityId,
      child?.purpose ?? `Open governed target ${humanize(childCapabilityId)}.`,
      child ? [child.platformId] : undefined,
      metadata,
    );
  });
};

export const buildAiOpenEntries = (): CapabilityCatalogEntry[] => [...buildAiEntries(), ...buildOpenEntries()];
