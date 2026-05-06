import type { DomainInspector } from "./schema.js";

import { auditCoverageGovernanceInspector } from "../domains/audit-coverage-governance/inspector.js";
import { capabilityGroupGovernanceInspector } from "../domains/capability-group-governance/inspector.js";

export const coreGovernanceCapabilityInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/audit-coverage-governance/inspector.ts": auditCoverageGovernanceInspector,
  "scripts/audit/domains/capability-group-governance/inspector.ts": capabilityGroupGovernanceInspector,
};