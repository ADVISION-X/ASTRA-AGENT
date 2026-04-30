import { finalizeInspectorResult, createFinding, createPhase } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { AUDIT_LAW_ID } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runOwnerFoundation } from "./owner-foundation.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const CAPABILITY_DOMAIN = "commander-console-ui";
const INSPECTOR_ID = "commander-console-ui-owner";

const inspector: DomainInspector = async (context) => {
  const ownerFoundation = await runOwnerFoundation(context);
  const required = await runRequiredShapeAttack();
  const boundary = runBoundaryAttack();
  const antiEscape = runAntiEscapeAttack();
  const negativeProof = await runNegativeProofHarness();

  const findings = [
    ...ownerFoundation.findings,
    ...required.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...ownerFoundation.phases,
    required.phase,
    boundary.phase,
    antiEscape.phase,
    negativeProof.phase,
  ];
  const summary = phases.find((phase) => phase.classification !== "PASS")?.summary
    ?? "commander-console-ui is enforced as an independent local shell subcheck.";

  return finalizeInspectorResult({
    inspector: "GrassEye Commander Console UI Owner Inspector",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings,
    phases,
    summary,
  });
};

export { inspector as commanderConsoleUiInspector };