import type { DomainInspector } from "./schema.js";

import { evidenceMapForensicsInspectorRegistry } from "./inspector-registry-evidence-map-forensics.js";
import { evidenceMouseVisualInspectorRegistry } from "./inspector-registry-evidence-mouse-visual.js";

export const evidenceInspectorRegistry: Record<string, DomainInspector> = {
  ...evidenceMapForensicsInspectorRegistry,
  ...evidenceMouseVisualInspectorRegistry,
};