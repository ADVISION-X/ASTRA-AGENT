import type { DomainInspector } from "./schema.js";

import { commanderConsoleCapabilityInspector } from "../domains/commander-console-capability/inspector.js";
import { orchestrationCapabilityInspector } from "../domains/orchestration-capability/inspector.js";
import { structuredLoggingInspector } from "../domains/structured-logging/inspector.js";

export const runtimeOpsInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/commander-console-capability/inspector.ts": commanderConsoleCapabilityInspector,
  "scripts/audit/domains/orchestration-capability/inspector.ts": orchestrationCapabilityInspector,
  "scripts/audit/domains/structured-logging/inspector.ts": structuredLoggingInspector,
};