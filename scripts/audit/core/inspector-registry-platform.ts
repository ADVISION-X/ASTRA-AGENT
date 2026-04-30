import type { DomainInspector } from "./schema.js";

import { platformGeometryClickInspectorRegistry } from "./inspector-registry-platform-geometry-click.js";
import { platformOpenScreenInspectorRegistry } from "./inspector-registry-platform-open-screen.js";
import { platformTextInspectorRegistry } from "./inspector-registry-platform-text.js";

export const platformInspectorRegistry: Record<string, DomainInspector> = {
  ...platformOpenScreenInspectorRegistry,
  ...platformGeometryClickInspectorRegistry,
  ...platformTextInspectorRegistry,
};