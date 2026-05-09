import { finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector } from "../../core/schema.js";
import { runAntiEscape } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShape } from "./forbidden-shape.js";
import { runRequiredShape } from "./required-shape.js";

const inspector: DomainInspector = async (context) => {
  const required = await runRequiredShape();
  const forbidden = await runForbiddenShape();
  const boundary = runBoundaryAttack();
  const antiEscape = await runAntiEscape(context);

  const findings = [
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
  ];
  const phases = [required.phase, forbidden.phase, boundary.phase, antiEscape.phase];

  return finalizeInspectorResult({
    inspector: "GrassEye Map Prompt Contract Governance Inspector",
    inspectorId: "map-prompt-contract-governance",
    capabilityDomain: "map-prompt-contract",
    findings,
    phases,
    summary: phases.find((phase) => !phase.passed)?.summary ?? "Map prompt contract governance passes required-shape, boundary, and anti-escape checks.",
  });
};

export { inspector as mapPromptContractInspector };