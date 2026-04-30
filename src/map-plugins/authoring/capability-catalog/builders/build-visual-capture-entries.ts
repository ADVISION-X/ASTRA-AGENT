import { getScreenshotChildRegistryEntry, listScreenshotChildren } from "../../../../capabilities/screenshot/registry.js";
import { listVisualTargetChildren } from "../../../../capabilities/visual-target/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

const buildScreenshotEntries = (): CapabilityCatalogEntry[] =>
  listScreenshotChildren().map((childCapabilityId) => {
    const child = getScreenshotChildRegistryEntry(childCapabilityId);
    return buildEntry(
      "screenshot",
      childCapabilityId,
      child ? `Capture governed screenshot for ${child.outputImageKind} in ${child.coordinateSpacePolicy}.` : `Capture governed screenshot for ${humanize(childCapabilityId)}.`,
    );
  });

const buildVisualTargetEntries = (): CapabilityCatalogEntry[] =>
  listVisualTargetChildren().map((childCapabilityId) =>
    buildEntry("visual-target", childCapabilityId, `Resolve a governed visual target for ${humanize(childCapabilityId)}.`),
  );

export const buildVisualCaptureEntries = (): CapabilityCatalogEntry[] => [
  ...buildScreenshotEntries(),
  ...buildVisualTargetEntries(),
];