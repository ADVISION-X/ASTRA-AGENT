import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { createAuditProject } from "./inspection-ast-helpers.js";
import { orchestrationInspectionConstants as config } from "./inspection-constants.js";
import { inspectMissionLoopEventSemantics } from "./mission-loop-event-semantics-checks.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runOrchestrationGovernedRuntimeChecks } from "./run-governed-runtime-checks.js";
import { runOrchestrationCapabilityChecks } from "./run-orchestration-capability-checks.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF";

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
    const [packageChecks, governedRuntimeChecks, negativeProof] = await Promise.all([
      runOrchestrationCapabilityChecks(),
      runOrchestrationGovernedRuntimeChecks(),
      process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
        ? Promise.resolve({
            findings: [],
            phase: {
              name: "negative-proof-harness",
              classification: "PASS" as const,
              passed: true,
              summary: "Orchestration negative-proof harness was skipped for nested inspector execution.",
            },
          })
        : runNegativeProofHarness(),
    ]);
      const loopSemantics = inspectMissionLoopEventSemantics(project);
    const filteredGovernedRuntimeFindings = governedRuntimeChecks.findings.filter((finding) => ![
      "Mission loop must emit governed step-selection, gate, dispatch, transition, and terminal runtime events after command acceptance.",
      "Mission loop terminal outcome handling must map terminal mission states to governed runtime event types.",
    ].includes(finding.message));
    const filteredGovernedRuntimePhases = governedRuntimeChecks.phases.filter((phase) => phase.name !== "mission-loop-traceability");

    return {
      findings: [...packageChecks.findings, ...filteredGovernedRuntimeFindings, ...loopSemantics.findings, ...negativeProof.findings],
      phases: [...packageChecks.phases, ...filteredGovernedRuntimePhases, loopSemantics.phase, negativeProof.phase],
    };
  },
});
