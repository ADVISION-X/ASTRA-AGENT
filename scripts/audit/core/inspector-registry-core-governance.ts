import type { DomainInspector } from "./schema.js";

import { coreGovernanceBoundaryInspectorRegistry } from "./inspector-registry-core-governance-boundary.js";
import { coreGovernanceCapabilityInspectorRegistry } from "./inspector-registry-core-governance-capability.js";
import { coreGovernanceRoutingInspectorRegistry } from "./inspector-registry-core-governance-routing.js";

export const coreGovernanceInspectorRegistry: Record<string, DomainInspector> = {
  ...coreGovernanceCapabilityInspectorRegistry,
  ...coreGovernanceBoundaryInspectorRegistry,
  ...coreGovernanceRoutingInspectorRegistry,
};