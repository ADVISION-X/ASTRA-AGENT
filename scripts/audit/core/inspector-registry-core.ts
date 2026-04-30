import type { DomainInspector } from "./schema.js";

import { coreAiAuditInspectorRegistry } from "./inspector-registry-core-ai-audit.js";
import { coreGovernanceInspectorRegistry } from "./inspector-registry-core-governance.js";
import { coreTypeInspectorRegistry } from "./inspector-registry-core-type.js";

export const coreInspectorRegistry: Record<string, DomainInspector> = {
  ...coreAiAuditInspectorRegistry,
  ...coreGovernanceInspectorRegistry,
  ...coreTypeInspectorRegistry,
};