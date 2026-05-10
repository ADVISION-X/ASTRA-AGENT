import type { DomainInspector } from "./schema.js";

import { forensicsPersistenceCapabilityInspector } from "../domains/forensics-persistence-capability/inspector.js";

export const evidenceMapForensicsInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/forensics-persistence-capability/inspector.ts": forensicsPersistenceCapabilityInspector,
};