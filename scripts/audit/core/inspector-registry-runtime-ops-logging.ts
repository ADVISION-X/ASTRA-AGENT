import type { DomainInspector } from "./schema.js";

import { runtimeDebugTransparencyInspector } from "../domains/runtime-debug-transparency/inspector.js";
import { structuredLoggingInspector } from "../domains/structured-logging/inspector.js";

export const runtimeOpsLoggingInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/runtime-debug-transparency/inspector.ts": runtimeDebugTransparencyInspector,
  "scripts/audit/domains/structured-logging/inspector.ts": structuredLoggingInspector,
};
