import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { ROOT } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";

export default createPendingDomainInspector({
  inspector: "GrassEye Text Input Capability Owner Inspector",
  inspectorId: "text-input-capability-owner",
  capabilityDomain: "text-input-capability",
  inspectorEntry: "scripts/audit/domains/text-input-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "text-input-capability law exists but production-grade writing execution boundaries are not fully enforced yet",
  implementedSummary: "text-input-capability is implemented as a governed schema-first writing execution owner with AST-backed enforcement",
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
            summary: "Text Input negative-proof harness was skipped for nested inspector execution.",
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