import { finalizeInspectorResult, createFinding, createPhase } from "../../core/result.js";
import type { DomainInspector, Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import { AUDIT_LAW_ID } from "./ast-utils.js";
import { runAntiEscapeAttack } from "./anti-escape.js";
import { runBoundaryAttack } from "./boundary-attack.js";
import { runNegativeProofHarness } from "./negative-proof-harness.js";
import { runRequiredShapeAttack } from "./required-shape.js";

const CAPABILITY_DOMAIN = "commander-console-ui";
const INSPECTOR_ID = "commander-console-ui-owner";
const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-ui/inspector.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-ui/manifest.json";

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
      message: "commander-console-ui manifest is missing.",
    }));
    phases.push(createPhase("owner-foundation", "LAW GAP", false, "commander-console-ui manifest is missing."));
    return { findings, phases };
  }

  if (manifest.inspectorId !== INSPECTOR_ID) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-ui manifest inspectorId does not match the owner inspector.",
    }));
  }

  if (manifest.entry !== INSPECTOR_ENTRY) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-ui manifest entry does not match the inspector file.",
    }));
  }

  if (!manifest.owner) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-ui manifest must declare owner: true.",
    }));
  }

  if (!(await fileExists(pathFromRepoRoot(INSPECTOR_ENTRY)))) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: INSPECTOR_ENTRY,
      line: 1,
      severity: "fatal",
      message: "commander-console-ui inspector entry file does not exist.",
    }));
  }

  if (manifest.readsLawFiles.length === 0) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "error",
      message: "commander-console-ui manifest must declare readsLawFiles.",
    }));
  }

  const matrixOwner = context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN);
  if (!matrixOwner) {
    findings.push(createFinding({
      lawId: AUDIT_LAW_ID,
      file: MANIFEST_PATH,
      line: 1,
      severity: "fatal",
      message: "Generated enforcement matrix does not contain commander-console-ui.",
    }));
  }

  phases.push(createPhase(
    "owner-foundation",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "commander-console-ui is registered as an independent owner manifest and matrix owner outside the frozen phase gate by design."
      : "commander-console-ui owner manifest or generated matrix drift is blocking enforcement.",
  ));

  return { findings, phases };
}

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