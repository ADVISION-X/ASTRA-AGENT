import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { ROOT } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF";

export default createPendingDomainInspector({
  inspector: "GrassEye Nerve Bus Capability Owner Inspector",
  inspectorId: "nerve-bus-capability-owner",
  capabilityDomain: "nerve-bus-capability",
  inspectorEntry: "scripts/audit/domains/nerve-bus-capability/inspector.ts",
  ownedPaths: [ROOT],
  pendingSummary: "nerve-bus-capability law exists but the governed transport spine is not fully locked down yet",
  implementedSummary: "nerve-bus-capability is implemented as a schema-first governed transport spine with AST-backed enforcement",
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
            summary: "Nerve Bus negative-proof harness was skipped for nested inspector execution.",
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
