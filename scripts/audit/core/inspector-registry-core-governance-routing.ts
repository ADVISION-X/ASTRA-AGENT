import type { DomainInspector } from "./schema.js";

import { indexInspector } from "../domains/index/inspector.js";
import { kernelInspector } from "../domains/kernel/inspector.js";

export const coreGovernanceRoutingInspectorRegistry: Record<string, DomainInspector> = {
  "scripts/audit/domains/index/inspector.ts": indexInspector,
  "scripts/audit/domains/kernel/inspector.ts": kernelInspector,
};