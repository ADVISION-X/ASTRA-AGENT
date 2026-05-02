import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF";

export const mouseScrollCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Scroll Capability Owner Inspector",
  inspectorId: "mouse-scroll-capability-owner",
  capabilityDomain: "mouse-scroll-capability",
  inspectorEntry: "scripts/audit/domains/mouse-scroll-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "mouse-scroll-capability law exists but production-grade scroll execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-scroll-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const required = await runRequiredShapeAttack();
    const forbidden = runForbiddenShapeAttack();
    const boundary = runBoundaryAttack();
    const antiEscape = runAntiEscapeAttack();
    const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
      ? {
          findings: [],
          phase: {
            name: "negative-proof-harness",
            classification: "PASS" as const,
            passed: true,
            summary: "Mouse Scroll negative-proof harness was skipped for nested inspector execution.",
          },
        }
      : await runNegativeProofHarness();

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