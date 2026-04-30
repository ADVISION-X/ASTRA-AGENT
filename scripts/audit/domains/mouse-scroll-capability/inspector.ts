import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { ROOT } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

export const mouseScrollCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Scroll Capability Owner Inspector",
  inspectorId: "mouse-scroll-capability-owner",
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "mouse-scroll-capability law exists but production-grade scroll execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-scroll-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const required = await runRequiredShapeAttack();
    const forbidden = runForbiddenShapeAttack();
    const boundary = runBoundaryAttack();
    const antiEscape = runAntiEscapeAttack();
    const negativeProof = await runNegativeProofHarness();

    return {
      findings: [
        ...required.findings,
        ...forbidden.findings,
        ...boundary.findings,
        ...antiEscape.findings,
        ...negativeProof.findings,
      ],
      phases: [
        required.phase,
        forbidden.phase,
        boundary.phase,
        antiEscape.phase,
        negativeProof.phase,
      ],
    };
  },
});