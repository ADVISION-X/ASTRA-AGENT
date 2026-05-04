import type { DomainInspector } from "./schema.js";

import { debugLoopBoundaryInspector } from "../domains/debug-loop-boundary/inspector.js";
import { securityPrivacyInspector } from "../domains/security-privacy/inspector.js";

export const coreGovernanceBoundaryInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/debug-loop-boundary/inspector.ts": debugLoopBoundaryInspector,
  "scripts/audit/domains/security-privacy/inspector.ts": securityPrivacyInspector,
};