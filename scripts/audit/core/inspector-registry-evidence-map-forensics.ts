import type { DomainInspector } from "./schema.js";

import { forensicsPersistenceCapabilityInspector } from "../domains/forensics-persistence-capability/inspector.js";
import { mapPluginPackageInspector } from "../domains/map-plugin-package/inspector.js";

export const evidenceMapForensicsInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/forensics-persistence-capability/inspector.ts": forensicsPersistenceCapabilityInspector,
  "scripts/audit/domains/map-plugin-package/inspector.ts": mapPluginPackageInspector,
};