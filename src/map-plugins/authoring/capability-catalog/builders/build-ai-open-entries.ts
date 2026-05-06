import { listMapPluginAiChildren } from "./ai-capability-catalog-source.js";
import { listMapPluginOpenCatalogEntries } from "./open-capability-catalog-source.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildAiEntries = (): CapabilityCatalogEntry[] => {
  return listMapPluginAiChildren().map((childCapabilityId) =>
    buildEntry({
      abilityGroupId: "ai",
      childCapabilityId,
      description: `Execute governed AI child ${humanize(childCapabilityId)} for governed tasks.`,
    }),
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
    const supportedTargets = isLocalProgram
      ? ["macos-local", "local-program-window", "desktop-screen"]
      : child ? [child.platformId] : undefined;
    return buildEntry({
      abilityGroupId: "open",
      childCapabilityId,
      description: child?.purpose ?? `Open governed target ${humanize(childCapabilityId)}.`,
      ...(supportedTargets ? { supportedTargets } : {}),
      ...(metadata ? { metadata } : {}),
    });
  });
};

export const buildAiOpenEntries = (): CapabilityCatalogEntry[] => [...buildAiEntries(), ...buildOpenEntries()];
