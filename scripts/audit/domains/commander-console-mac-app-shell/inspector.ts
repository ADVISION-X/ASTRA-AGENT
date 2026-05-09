import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { runAntiEscapeAttack } from "./anti-escape.js";
import { runAtomicQualityGate } from "./atomic-quality-gate.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runOwnerFoundation } from "./owner-foundation.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runScorecardGate } from "./scorecard-gate.js";

const CAPABILITY_DOMAIN = "commander-console-mac-app-shell";
const INSPECTOR_ID = "commander-console-mac-app-shell-owner";

const inspector: DomainInspector = async (context) => {
  const ownerFoundation = await runOwnerFoundation(context);
  const required = await runRequiredShapeAttack();
  const forbidden = await runForbiddenShapeAttack();
  const boundary = runBoundaryAttack();
  const antiEscape = runAntiEscapeAttack();
  const atomicQualityGate = await runAtomicQualityGate();
  const scorecardGate = await runScorecardGate();

  const findings = [
    ...ownerFoundation.findings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...atomicQualityGate.findings,
    ...scorecardGate.findings,
  ];
  const phases = [
    ...ownerFoundation.phases,
    required.phase,
    forbidden.phase,
    boundary.phase,
    antiEscape.phase,
    atomicQualityGate.phase,
    scorecardGate.phase,
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
