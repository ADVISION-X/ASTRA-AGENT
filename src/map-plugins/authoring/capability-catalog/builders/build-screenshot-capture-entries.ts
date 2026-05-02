import { getScreenshotChildRegistryEntry, listScreenshotChildren } from "../../../../capabilities/screenshot/registry.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

export const buildScreenshotCaptureEntries = (): CapabilityCatalogEntry[] =>
  listScreenshotChildren().map((childCapabilityId) => {
    const child = getScreenshotChildRegistryEntry(childCapabilityId);
    return buildEntry(
      "screenshot",
      childCapabilityId,
      child ? `Capture governed screenshot for ${child.outputImageKind} in ${child.coordinateSpacePolicy}.` : `Capture governed screenshot for ${humanize(childCapabilityId)}.`,
    );
  });