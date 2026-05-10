import type { DomainInspector } from "./schema.js";

import { securityPrivacyInspector } from "../domains/security-privacy/inspector.js";

export const coreGovernanceBoundaryInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/security-privacy/inspector.ts": securityPrivacyInspector,
};