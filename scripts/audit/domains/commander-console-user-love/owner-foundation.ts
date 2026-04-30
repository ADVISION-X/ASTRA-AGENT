import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { AUDIT_LAW_ID } from "./ast-utils.js";

const CAPABILITY_DOMAIN = "commander-console-user-love";
const INSPECTOR_ID = "commander-console-user-love-owner";
const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-user-love/inspector.ts";
const MANIFEST_PATH = "scripts/audit/domains/commander-console-user-love/manifest.json";

const createMissingManifestResult = (): { findings: Finding[]; phases: InspectorPhase[] } => ({
  findings: [createFinding({
    lawId: AUDIT_LAW_ID,
    file: MANIFEST_PATH,
    line: 1,
    severity: "fatal",
    message: "commander-console-user-love manifest is missing.",
  })],
  phases: [createPhase("owner-foundation", "LAW GAP", false, "commander-console-user-love manifest is missing.")],
});

const createOwnerFoundationPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "owner-foundation",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "commander-console-user-love is registered as a standalone local shell audit domain outside the frozen phase gate."
      : "commander-console-user-love manifest or generated matrix drift is blocking enforcement.",
  );

const collectManifestFindings = async (context: InspectorContext): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  if (!manifest) {
    return createMissingManifestResult().findings;
  }

  if (manifest.inspectorId !== INSPECTOR_ID) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-user-love manifest inspectorId does not match the owner inspector." }));
  }
  if (manifest.entry !== INSPECTOR_ENTRY) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-user-love manifest entry does not match the inspector file." }));
  }
  if (!manifest.owner) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-user-love manifest must declare owner: true." }));
  }
  if (!(await fileExists(pathFromRepoRoot(INSPECTOR_ENTRY)))) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: INSPECTOR_ENTRY, line: 1, severity: "fatal", message: "commander-console-user-love inspector entry file does not exist." }));
  }
  if (manifest.readsLawFiles.length === 0) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: MANIFEST_PATH, line: 1, severity: "error", message: "commander-console-user-love manifest must declare readsLawFiles." }));
  }
  if (!context.matrixOwnersByDomain.get(CAPABILITY_DOMAIN)) {
    findings.push(createFinding({ lawId: AUDIT_LAW_ID, file: MANIFEST_PATH, line: 1, severity: "fatal", message: "Generated enforcement matrix does not contain commander-console-user-love." }));
  }

  return findings;
};

export async function runOwnerFoundation(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const manifest = context.manifestsByDomain.get(CAPABILITY_DOMAIN);
  if (!manifest) {
    return createMissingManifestResult();
  }

  const findings = await collectManifestFindings(context);
  return { findings, phases: [createOwnerFoundationPhase(findings)] };
}