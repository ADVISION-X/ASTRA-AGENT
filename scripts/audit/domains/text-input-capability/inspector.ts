import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { makeProject } from "./project-access.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runWriteOwnershipAttack } from "./run-write-ownership-attack.js";

export const textInputCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Text Input Capability Owner Inspector",
  inspectorId: "text-input-capability-owner",
  capabilityDomain: "text-input-capability",
  inspectorEntry: "scripts/audit/domains/text-input-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "text-input-capability law exists but production-grade writing execution boundaries are not fully enforced yet",
  implementedSummary: "text-input-capability is implemented as a governed schema-first writing execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const project = makeProject();
    const lawBaseline = await runLawBaselineCheck();
    const required = await runRequiredShapeAttack(project);
    const forbidden = runForbiddenShapeAttack(project);
    const boundary = runBoundaryAttack(project);
    const ownership = runWriteOwnershipAttack(project);
    const antiEscape = runAntiEscapeAttack(project);

    return {
      findings: [
        ...lawBaseline.findings,
        ...required.findings,
        ...forbidden.findings,
        ...boundary.findings,
        ...ownership.findings,
        ...antiEscape.findings,
      ],
      phases: [
        lawBaseline.phase,
        required.phase,
        forbidden.phase,
        boundary.phase,
        ownership.phase,
        antiEscape.phase,
      ],
    };
  },
});