import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";

const CAPABILITY_DOMAIN = "commander-console-mac-app-shell";
const INSPECTOR_ID = "commander-console-mac-app-shell-owner";
const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-mac-app-shell/inspector.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-mac-app-shell/manifest.json";
const PHASE_GATE_PATH = "scripts/audit/phase-gates/phase-04-full-enforcement.json";

const createMissingManifestResult = (): { findings: Finding[]; phases: InspectorPhase[] } => ({
  findings: [createFinding({
    lawId: LAW_IDS.AUDIT,
    file: MANIFEST_PATH,
    line: 1,
    severity: "fatal",
    message: "commander-console-mac-app-shell manifest is missing.",
  })],
  phases: [createPhase("owner-foundation", "LAW GAP", false, "commander-console-mac-app-shell manifest is missing.")],
});

const createOwnerFoundationPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "owner-foundation",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "commander-console-mac-app-shell is registered as an active audit owner and runner participant."
      : "commander-console-mac-app-shell manifest, matrix, or phase-gate drift is blocking enforcement.",
  );

const collectManifestShapeFindings = async (context: InspectorContext): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  if (!manifest) {
    return createMissingManifestResult().findings;
  }

  if (manifest.inspectorId !== INSPECTOR_ID) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-mac-app-shell manifest inspectorId does not match the owner inspector." }));
  }
  if (manifest.entry !== INSPECTOR_ENTRY) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-mac-app-shell manifest entry does not match the inspector file." }));
  }
  if (!manifest.owner) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-mac-app-shell manifest must declare owner: true." }));
  }
  if (!(await fileExists(pathFromRepoRoot(INSPECTOR_ENTRY)))) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: INSPECTOR_ENTRY, line: 1, severity: "fatal", message: "commander-console-mac-app-shell inspector entry file does not exist." }));
  }
  if (manifest.readsLawFiles.length === 0) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-mac-app-shell manifest must declare readsLawFiles." }));
  }

  return findings;
};

const collectRuntimeRegistrationFindings = (context: InspectorContext): Finding[] => {
  const findings: Finding[] = [];
  if (!context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN)) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: MANIFEST_PATH, line: 1, severity: "fatal", message: "Generated enforcement matrix does not contain commander-console-mac-app-shell." }));
  }
  if (!context.planOwnersByDomain.get(CAPABILITY_DOMAIN)) {
    findings.push(createFinding({ lawId: LAW_IDS.AUDIT, file: PHASE_GATE_PATH, line: 1, severity: "fatal", message: "Phase gate does not activate commander-console-mac-app-shell, so the audit runner would skip it." }));
  }

  return findings;
};

export async function runOwnerFoundation(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  if (!manifest) {
    return createMissingManifestResult();
  }

  const findings = [
    ...(await collectManifestShapeFindings(context)),
    ...collectRuntimeRegistrationFindings(context),
  ];
  return { findings, phases: [createOwnerFoundationPhase(findings)] };
}