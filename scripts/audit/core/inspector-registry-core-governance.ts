import type { DomainInspector } from "./schema.js";

import { capabilityGroupGovernanceInspector } from "../domains/capability-group-governance/inspector.js";
import { securityPrivacyInspector } from "../domains/security-privacy/inspector.js";

export const coreGovernanceInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/capability-group-governance/inspector.ts": capabilityGroupGovernanceInspector,
  "scripts/audit/domains/security-privacy/inspector.ts": securityPrivacyInspector,
};