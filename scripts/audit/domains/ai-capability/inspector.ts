import type { Finding } from "../../core/schema.js";
import { createAuditProject } from "../_shared/ast-helpers.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { aiInspectionConstants } from "./inspection-constants.js";
import { runAiBoundaryChecks } from "./run-ai-boundary-checks.js";
import { runAiRuntimeContractChecks } from "./run-ai-runtime-contract-checks.js";
import { runAiStructureChecks } from "./run-ai-structure-checks.js";

const { AI_ROOT, INSPECTOR_ENTRY } = aiInspectionConstants;

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
    const findings: Finding[] = [
      ...await runAiStructureChecks(project),
      ...runAiRuntimeContractChecks(project),
      ...runAiBoundaryChecks(project),
    ];

    return {
      findings,
      phases: [],
    };
  },
});
