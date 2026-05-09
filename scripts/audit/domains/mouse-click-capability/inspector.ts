import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { makeProject } from "./audit-project.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runClickOwnershipAttack } from "./run-click-ownership-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runJointResultContractCheck } from "./run-joint-result-contract-check.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runRequiredShapeAttack } from "./required-shape.js";

export const mouseClickCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Click Capability Owner Inspector",
  inspectorId: "mouse-click-capability-owner",
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "mouse-click-capability law exists but production-grade click execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-click-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = makeProject();
    const lawBaseline = await runLawBaselineCheck();
    const required = await runRequiredShapeAttack(project);
    const forbidden = runForbiddenShapeAttack(project);
    const boundary = runBoundaryAttack(project);
    const ownership = runClickOwnershipAttack(project);
    const antiEscape = runAntiEscapeAttack(project);
    const jointResultContract = await runJointResultContractCheck();

    return {
      findings: [
        ...lawBaseline.findings,
        ...required.findings,
        ...forbidden.findings,
        ...boundary.findings,
        ...ownership.findings,
        ...antiEscape.findings,
        ...jointResultContract.findings,
      ],
      phases: [
        lawBaseline.phase,
        required.phase,
        forbidden.phase,
        boundary.phase,
        ownership.phase,
        antiEscape.phase,
        jointResultContract.phase,
      ],
    };
  },
});