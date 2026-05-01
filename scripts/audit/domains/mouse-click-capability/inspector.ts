import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF";

export const mouseClickCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Mouse Click Capability Owner Inspector",
  inspectorId: "mouse-click-capability-owner",
  capabilityDomain: "mouse-click-capability",
  inspectorEntry: "scripts/audit/domains/mouse-click-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "mouse-click-capability law exists but production-grade click execution boundaries are not fully enforced yet",
  implementedSummary: "mouse-click-capability is implemented as a governed schema-first primitive execution owner with AST-backed enforcement",
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
            summary: "Mouse Click negative-proof harness was skipped for nested inspector execution.",
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