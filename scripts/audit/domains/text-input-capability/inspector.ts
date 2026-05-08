import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { makeProject } from "./project-access.js";
import { PATHS } from "./config.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runLawBaselineCheck } from "./run-law-baseline-check.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { type TargetNegativeProofPhase } from "./negative-proof-mutations.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runWriteOwnershipAttack } from "./run-write-ownership-attack.js";

const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF";
const TARGET_NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_TEXT_INPUT_NEGATIVE_PROOF_PHASE";

function resolveTargetNegativeProofPhase(): TargetNegativeProofPhase | null {
  const phase = process.env[TARGET_NEGATIVE_PROOF_PHASE_ENV];
  switch (phase) {
    case "law-baseline":
    case "required":
    case "forbidden":
    case "boundary":
    case "write-ownership":
    case "anti-escape":
      return phase;
    default:
      return null;
  }
}

async function runTargetedNegativeProofPhase(phase: TargetNegativeProofPhase) {
  if (phase === "law-baseline") {
    return runLawBaselineCheck();
  }

  const project = makeProject();
  switch (phase) {
    case "required":
      return runRequiredShapeAttack(project);
    case "forbidden":
      return runForbiddenShapeAttack(project);
    case "boundary":
      return runBoundaryAttack(project);
    case "write-ownership":
      return runWriteOwnershipAttack(project);
    case "anti-escape":
      return runAntiEscapeAttack(project);
    default:
      return runLawBaselineCheck();
  }
}

export const textInputCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Text Input Capability Owner Inspector",
  inspectorId: "text-input-capability-owner",
  capabilityDomain: "text-input-capability",
  inspectorEntry: "scripts/audit/domains/text-input-capability/inspector.ts",
  ownedPaths: [PATHS.ROOT],
  pendingSummary: "text-input-capability law exists but production-grade writing execution boundaries are not fully enforced yet",
  implementedSummary: "text-input-capability is implemented as a governed schema-first writing execution owner with AST-backed enforcement",
  extraChecks: async () => {
    const targetPhase = resolveTargetNegativeProofPhase();
    if (targetPhase) {
      const targetedResult = await runTargetedNegativeProofPhase(targetPhase);
      return {
        findings: targetedResult.findings,
        phases: [targetedResult.phase],
      };
    }

    const project = makeProject();
    const lawBaseline = await runLawBaselineCheck();
    const required = await runRequiredShapeAttack(project);
    const forbidden = runForbiddenShapeAttack(project);
    const boundary = runBoundaryAttack(project);
    const ownership = runWriteOwnershipAttack(project);
    const antiEscape = runAntiEscapeAttack(project);
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
        ...lawBaseline.findings,
        ...required.findings,
        ...forbidden.findings,
        ...boundary.findings,
        ...ownership.findings,
        ...antiEscape.findings,
        ...negativeProof.findings,
      ],
      phases: [
        lawBaseline.phase,
        required.phase,
        forbidden.phase,
        boundary.phase,
        ownership.phase,
        antiEscape.phase,
        negativeProof.phase,
      ],
    };
  },
});