import type { DomainInspector } from "./schema.js";

import { structuredLoggingInspector } from "../domains/structured-logging/inspector.js";

export const runtimeOpsLoggingInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/structured-logging/inspector.ts": structuredLoggingInspector,
};