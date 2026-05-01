import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { runAntiEscapeAttack } from "./anti-escape.js";
import { runAtomicQualityGate } from "./atomic-quality-gate.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runOwnerFoundation } from "./owner-foundation.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runScorecardGate } from "./scorecard-gate.js";

const CAPABILITY_DOMAIN = "commander-console-mac-app-shell";
const INSPECTOR_ID = "commander-console-mac-app-shell-owner";

const getNegativeProofResult = async (skipNegativeProof: boolean) => (
  skipNegativeProof
    ? {
        findings: [],
        phase: createPhase("negative-proof-harness", "PASS", true, "Negative proof is intentionally skipped for the harness baseline run."),
      }
    : runNegativeProofHarness()
);

const inspector: DomainInspector = async (context) => {
  const skipNegativeProof = process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF === "1";
  const ownerFoundation = await runOwnerFoundation(context);
  const required = await runRequiredShapeAttack();
  const forbidden = await runForbiddenShapeAttack();
  const boundary = runBoundaryAttack();
  const antiEscape = runAntiEscapeAttack();
  const atomicQualityGate = await runAtomicQualityGate();
  const scorecardGate = await runScorecardGate();
  const negativeProof = await getNegativeProofResult(skipNegativeProof);

  const findings = [
    ...ownerFoundation.findings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...atomicQualityGate.findings,
    ...scorecardGate.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...ownerFoundation.phases,
    required.phase,
    forbidden.phase,
    boundary.phase,
    antiEscape.phase,
    atomicQualityGate.phase,
    scorecardGate.phase,
    negativeProof.phase,
  ];
  const summary = phases.find((phase) => phase.classification !== "PASS")?.summary
    ?? "Commander Console Mac app shell is ready to establish.";

  return finalizeInspectorResult({
    inspector: "GrassEye Commander Console Mac App Shell Inspector",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings,
    phases,
    summary,
  });
};

export { inspector as commanderConsoleMacAppShellInspector };
