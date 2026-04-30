import type { DomainInspector } from "./schema.js";

import { mouseScrollCapabilityInspector } from "../domains/mouse-scroll-capability/inspector.js";
import { visualTargetCapabilityInspector } from "../domains/visual-target-capability/inspector.js";

export const evidenceMouseVisualInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/mouse-scroll-capability/inspector.ts": mouseScrollCapabilityInspector,
  "scripts/audit/domains/visual-target-capability/inspector.ts": visualTargetCapabilityInspector,
};