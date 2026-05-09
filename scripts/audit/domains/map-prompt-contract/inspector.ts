import { finalizeInspectorResult, createPhase } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShape } from "./required-shape.js";

const inspector: DomainInspector = async (context) => {
  const required = await runRequiredShape();
  const forbidden = await runForbiddenShape();
  const boundary = runBoundaryAttack();
  const antiEscape = await runAntiEscape(context);
  const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_MAP_PROMPT_CONTRACT_NEGATIVE_PROOF";
  const negativeProof = process.env[SKIP_NEGATIVE_PROOF_ENV]
    ? { findings: [], phase: createPhase("negative-proof-harness", "SKIPPED", true, "Negative proof skipped via env") }
    : await runNegativeProofHarness();

  const findings = [
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...negativeProof.findings,
  ];
  const phases = [required.phase, forbidden.phase, boundary.phase, antiEscape.phase, negativeProof.phase];

  return finalizeInspectorResult({
    inspector: "GrassEye Map Prompt Contract Governance Inspector",
    inspectorId: "map-prompt-contract-governance",
    capabilityDomain: "map-prompt-contract",
    findings,
    phases,
    summary: phases.find((phase) => !phase.passed)?.summary ?? "Map prompt contract governance passes required-shape, boundary, and negative-proof checks.",
  });
};

export { inspector as mapPromptContractInspector };