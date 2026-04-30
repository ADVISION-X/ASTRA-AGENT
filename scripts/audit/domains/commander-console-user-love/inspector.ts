import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { AUDIT_LAW_ID } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runForbiddenShapeAttack } from "./forbidden-shape.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";
import { runScorecardGate } from "./scorecard-gate.js";

const CAPABILITY_DOMAIN = "commander-console-user-love";
const INSPECTOR_ID = "commander-console-user-love-owner";
const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-user-love/inspector.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-user-love/manifest.json";

async function runOwnerFoundation(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);

  if (!manifest) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "fatal",
      message: "commander-console-user-love manifest is missing.",
    }));
    phases.push(createPhase("owner-foundation", "LAW GAP", false, "commander-console-user-love manifest is missing."));
    return { findings, phases };
  }

  if (manifest.inspectorId !== INSPECTOR_ID) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-user-love manifest inspectorId does not match the owner inspector.",
    }));
  }

  if (manifest.entry !== INSPECTOR_ENTRY) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-user-love manifest entry does not match the inspector file.",
    }));
  }

  if (!manifest.owner) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-user-love manifest must declare owner: true.",
    }));
  }

  if (!(await fileExists(pathFromRepoRoot(INSPECTOR_ENTRY)))) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: INSPECTOR_ENTRY,
      line: 1,
      severity: "fatal",
      message: "commander-console-user-love inspector entry file does not exist.",
    }));
  }

  if (manifest.readsLawFiles.length === 0) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-user-love manifest must declare readsLawFiles.",
    }));
  }

  const matrixOwner = context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN);
  if (!matrixOwner) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "fatal",
      message: "Generated enforcement matrix does not contain commander-console-user-love.",
    }));
  }

  phases.push(createPhase(
    "owner-foundation",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "commander-console-user-love is registered as a standalone local shell audit domain outside the frozen phase gate."
      : "commander-console-user-love manifest or generated matrix drift is blocking enforcement.",
  ));

  return { findings, phases };
}

const inspector: DomainInspector = async (context) => {
  const skipNegativeProof = process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_USER_LOVE_NEGATIVE_PROOF === "1";
  const ownerFoundation = await runOwnerFoundation(context);
  const required = await runRequiredShapeAttack();
  const forbidden = await runForbiddenShapeAttack();
  const boundary = runBoundaryAttack();
  const antiEscape = runAntiEscapeAttack();
  const scorecardGate = await runScorecardGate();
  const negativeProof = skipNegativeProof
    ? {
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Negative proof is intentionally skipped for the harness baseline run.",
        ),
      }
    : await runNegativeProofHarness();

  const findings = [
    ...ownerFoundation.findings,
    ...required.findings,
    ...forbidden.findings,
    ...boundary.findings,
    ...antiEscape.findings,
    ...scorecardGate.findings,
    ...negativeProof.findings,
  ];
  const phases = [
    ...ownerFoundation.phases,
    required.phase,
    forbidden.phase,
    boundary.phase,
    antiEscape.phase,
    scorecardGate.phase,
    negativeProof.phase,
  ];
  const summary = phases.find((phase) => phase.classification !== "PASS")?.summary
    ?? "Commander Console user-love is ready to establish.";

  return finalizeInspectorResult({
    inspector: "GrassEye Commander Console User Love Inspector",
    inspectorId: INSPECTOR_ID,
    capabilityDomain: CAPABILITY_DOMAIN,
    findings,
    phases,
    summary,
  });
};

export { inspector as commanderConsoleUserLoveInspector };