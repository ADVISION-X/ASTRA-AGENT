import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { createAuditProject } from "./inspection-ast-helpers.js";
import { visualTargetInspectionConstants as config } from "./inspection-constants.js";
import { runAntiEscapeAttack } from "./run-anti-escape-attack.js";
import { runBoundaryAttack } from "./run-boundary-attack.js";
import { runForbiddenShapeAttack } from "./run-forbidden-shape-attack.js";
import { runGeneratedChainCheck } from "./run-generated-chain-check.js";
import { runManifestCheck } from "./run-manifest-check.js";
import { runRequiredShapeAttack } from "./run-required-shape-attack.js";
import { runRunnerFailPowerCheck } from "./run-runner-fail-power-check.js";

export const visualTargetCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Visual Target Capability Owner Inspector",
  inspectorId: config.INSPECTOR_ID,
  capabilityDomain: config.CAPABILITY_DOMAIN,
  inspectorEntry: config.INSPECTOR_ENTRY,
  ownedPaths: [config.ROOT],
  pendingSummary: "visual-target-capability law exists but production-grade owner enforcement is incomplete",
  implementedSummary: "visual-target-capability is implemented as the canonical governed visual target owner with ts-morph attack enforcement",
  extraChecks: async (context) => {
    const project = createAuditProject();
    const typeChecker = project.getTypeChecker();
    const outcomes = await Promise.all([
      runRequiredShapeAttack(project),
      runForbiddenShapeAttack(project),
      runBoundaryAttack(project, typeChecker),
      runAntiEscapeAttack(project),
      runGeneratedChainCheck(context),
      runManifestCheck(),
      runRunnerFailPowerCheck(project),
    ]);

    return {
      findings: outcomes.flatMap((outcome) => outcome.findings),
      phases: outcomes.map((outcome) => outcome.phase),
    };
  },
});
