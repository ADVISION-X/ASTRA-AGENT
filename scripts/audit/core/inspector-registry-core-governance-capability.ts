import type { DomainInspector } from "./schema.js";

import { capabilityGroupGovernanceInspector } from "../domains/capability-group-governance/inspector.js";

export const coreGovernanceCapabilityInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/capability-group-governance/inspector.ts": capabilityGroupGovernanceInspector,
};
