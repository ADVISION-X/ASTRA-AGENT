import { listVisualTargetChildren } from "../../../../capabilities/visual-target/index.js";

import type { CapabilityCatalogEntry } from "../schema.js";
import { buildEntry, humanize } from "../policies.js";

export const buildVisualTargetCaptureEntries = (): CapabilityCatalogEntry[] =>
  listVisualTargetChildren().map((childCapabilityId) =>
    buildEntry("visual-target", childCapabilityId, `Resolve a governed visual target for ${humanize(childCapabilityId)}.`),
  );