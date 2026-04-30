import type { DomainInspector } from "./schema.js";

import { inspectTypeSafety as typeSafetyInspector } from "../domains/type-safety/inspector.js";

export const coreTypeInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/type-safety/inspector.ts": typeSafetyInspector,
};