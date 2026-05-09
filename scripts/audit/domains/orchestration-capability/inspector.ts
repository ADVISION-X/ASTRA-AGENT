import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { createAuditProject } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { inspectMissionLoopEventSemantics } from "./mission-loop-event-semantics-checks.js";
import { runMissionDebugObservabilityChecks } from "./run-mission-debug-observability-check.js";
import { runOrchestrationGovernedRuntimeChecks } from "./run-governed-runtime-checks.js";
import { runOrchestrationCapabilityChecks } from "./run-orchestration-capability-checks.js";
import { runOrchestrationRunLimitGovernanceChecks } from "./run-limit-governance-checks.js";

export const orchestrationCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Orchestration Capability Owner Inspector",
  inspectorId: "orchestration-capability-owner",
  capabilityDomain: "orchestration-capability",
  inspectorEntry: "scripts/audit/domains/orchestration-capability/inspector.ts",
  ownedPaths: [config.ROOT],
  pendingSummary: "orchestration-capability law exists but canonical commander root is not fully established yet",
  implementedSummary: "orchestration-capability is implemented as the canonical mission-command owner with governed maps, children, runtime, and Nerve Bus dispatch",
  extraChecks: async (context) => {
    const project = createAuditProject();
    const [packageChecks, governedRuntimeChecks, runLimitGovernance, missionDebugObservability] = await Promise.all([
      runOrchestrationCapabilityChecks(project),
      runOrchestrationGovernedRuntimeChecks(project),
      Promise.resolve(runOrchestrationRunLimitGovernanceChecks(project)),
      runMissionDebugObservabilityChecks(project),
    ]);
      const loopSemantics = inspectMissionLoopEventSemantics(project);
    const filteredGovernedRuntimeFindings = governedRuntimeChecks.findings.filter((finding) => ![
      "Mission loop must emit governed step-selection, gate, dispatch, transition, and terminal runtime events after command acceptance.",
      "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types.",
    ].includes(finding.message));
    const filteredGovernedRuntimePhases = governedRuntimeChecks.phases.filter((phase) => phase.name !== "mission-loop-traceability");

    return {
      findings: [...packageChecks.findings, ...filteredGovernedRuntimeFindings, ...runLimitGovernance.findings, ...missionDebugObservability.findings, ...loopSemantics.findings],
      phases: [...packageChecks.phases, ...filteredGovernedRuntimePhases, runLimitGovernance.phase, missionDebugObservability.phase, loopSemantics.phase],
    };
  },
});
