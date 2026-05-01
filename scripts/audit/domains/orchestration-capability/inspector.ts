import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { runOrchestrationCapabilityChecks } from "./run-orchestration-capability-checks.js";

export const orchestrationCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Orchestration Capability Owner Inspector",
  inspectorId: "orchestration-capability-owner",
  capabilityDomain: "orchestration-capability",
  inspectorEntry: "scripts/audit/domains/orchestration-capability/inspector.ts",
  ownedPaths: [config.ROOT],
  pendingSummary: "orchestration-capability law exists but canonical commander root is not fully established yet",
  implementedSummary: "orchestration-capability is implemented as the canonical mission-command owner with governed maps, children, runtime, and Nerve Bus dispatch",
  extraChecks: runOrchestrationCapabilityChecks,
});
