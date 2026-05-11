import type { DomainInspector } from "./schema.js";

import { aiCapabilityInspector } from "../domains/ai-capability/inspector.js";
import { inspectAuditSystem } from "../domains/audit-system/inspector.js";
import { localAiRuntimeInspector } from "../domains/local-ai-runtime/inspector.js";

export const coreAiAuditInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/ai-capability/inspector.ts": aiCapabilityInspector,
  "scripts/audit/domains/audit-system/inspector.ts": inspectAuditSystem,
  "scripts/audit/domains/local-ai-runtime/inspector.ts": localAiRuntimeInspector,
};