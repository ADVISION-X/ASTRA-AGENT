import type { Finding } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { aiInspectionConstants } from "./inspection-constants.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runAiBoundaryChecks } from "./run-ai-boundary-checks.js";
import { runAiRuntimeContractChecks } from "./run-ai-runtime-contract-checks.js";
import { runAiStructureChecks } from "./run-ai-structure-checks.js";

const { AI_ROOT, INSPECTOR_ENTRY } = aiInspectionConstants;
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_AI_NEGATIVE_PROOF";

export const aiCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye AI Capability Owner Inspector",
  inspectorId: "ai-capability-owner",
  capabilityDomain: "ai-capability",
  inspectorEntry: INSPECTOR_ENTRY,
  ownedPaths: [AI_ROOT],
  pendingSummary: "ai-capability static package is not established",
  implementedSummary: "ai-capability is rebuilt as a static capability package with ts-morph enforced runtime gates",
  extraChecks: async () => {
    const project = createAuditProject();
    const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
      ? {
          findings: [],
          phase: {
            name: "negative-proof-harness",
            classification: "PASS" as const,
            passed: true,
            summary: "AI negative-proof harness was skipped for nested inspector execution.",
          },
        }
      : await runNegativeProofHarness();
    const findings: Finding[] = [
      ...await runAiStructureChecks(project),
      ...runAiRuntimeContractChecks(project),
      ...runAiBoundaryChecks(project),
      ...negativeProof.findings,
    ];

    return {
      findings,
      phases: [negativeProof.phase],
    };
  },
});
