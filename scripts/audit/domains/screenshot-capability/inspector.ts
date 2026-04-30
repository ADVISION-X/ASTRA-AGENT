import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { runAntiEscape } from "./anti-escape.js";
import { ROOT, createScreenshotAuditProject } from "./ast-utils.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";
const INSPECTOR_PATH = "scripts/audit/domains/screenshot-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF";

export default createPendingDomainInspector({
  inspector: "GrassEye Screenshot Capability Owner Inspector",
  inspectorId: "screenshot-capability-owner",
  capabilityDomain: "screenshot-capability",
  inspectorEntry: INSPECTOR_PATH,
  ownedPaths: [ROOT],
  pendingSummary: "screenshot-capability root is missing its governed runtime package",
  implementedSummary: "screenshot-capability is implemented as a governed runtime package with layered AST-backed enforcement",
  extraChecks: async () => {
    const project = createScreenshotAuditProject();
    const required = await runRequiredShape(project);
    const forbidden = runForbiddenShape(project);
    const boundary = runBoundaryAttack(project);
    const antiEscape = runAntiEscape(project);
    const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV] === "1"
      ? {
          findings: [],
          phase: {
            name: "negative-proof-harness",
            classification: "PASS" as const,
            passed: true,
            summary: "Screenshot negative-proof harness was skipped for nested inspector execution.",
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
