import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runScrollOwnershipAttack } from "./run-scroll-ownership-attack.js";

export const mouseScrollCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Scroll Capability Owner Inspector",
  inspectorId: "mouse-scroll-capability-owner",
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "mouse-scroll-capability law exists but production-grade scroll execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-scroll-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const lawBaseline = await runLawBaselineCheck();
    const required = await runRequiredShapeAttack();
    const forbidden = runForbiddenShapeAttack();
    const boundary = runBoundaryAttack();
    const ownership = runScrollOwnershipAttack();
    const antiEscape = runAntiEscapeAttack();

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