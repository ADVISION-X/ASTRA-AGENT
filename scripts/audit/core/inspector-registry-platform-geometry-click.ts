import type { DomainInspector } from "./schema.js";

import { geometryGuardCapabilityInspector } from "../domains/geometry-guard-capability/inspector.js";
import { mouseClickCapabilityInspector } from "../domains/mouse-click-capability/inspector.js";

export const platformGeometryClickInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/geometry-guard-capability/inspector.ts": geometryGuardCapabilityInspector,
  "scripts/audit/domains/mouse-click-capability/inspector.ts": mouseClickCapabilityInspector,
};