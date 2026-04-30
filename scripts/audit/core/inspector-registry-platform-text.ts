import type { DomainInspector } from "./schema.js";

import { textInputCapabilityInspector } from "../domains/text-input-capability/inspector.js";

export const platformTextInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/text-input-capability/inspector.ts": textInputCapabilityInspector,
};