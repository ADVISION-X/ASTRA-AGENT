import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { kernelInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

type KernelManifest = {
  inspectorId?: string;
  capabilityDomain?: string;
  entry?: string;
  readsLawFiles?: string[];
  readsBlueprintFiles?: string[];
};

const {
  BLUEPRINT_FILE,
  INSPECTOR_ENTRY,
  KERNEL_FILE,
  MANIFEST_FILE,
  NEGATIVE_PROOF_HARNESS_FILE,
  PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE,
  REQUIREMENT_ID_001,
  RUN_INSPECTOR_FILE,
} = kernelInspectionConstants;

const addMissingFileFinding = (findings: Finding[], file: string, message: string): void => {
  findings.push(createFinding({
    lawId: REQUIREMENT_ID_001,
    file,
    line: 1,
    severity: "fatal",
    message,
  }));
};

const createManifestFinding = (message: string): Finding => createFinding({
  lawId: REQUIREMENT_ID_001,
  file: MANIFEST_FILE,
  line: 1,
  severity: "error",
  message,
});

const collectRequiredFileFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];

  if (!(await fileExists(pathFromRepoRoot(MANIFEST_FILE)))) {
    addMissingFileFinding(findings, MANIFEST_FILE, "Kernel routing owner manifest is missing.");
  }
  if (!(await fileExists(pathFromRepoRoot(RUN_INSPECTOR_FILE)))) {
    addMissingFileFinding(findings, RUN_INSPECTOR_FILE, "Kernel routing run-inspector entry is missing.");
  }
  if (!(await fileExists(pathFromRepoRoot(NEGATIVE_PROOF_HARNESS_FILE)))) {
    addMissingFileFinding(findings, NEGATIVE_PROOF_HARNESS_FILE, "Kernel routing negative-proof harness is missing.");
  }

  return findings;
};

const collectManifestReadFindings = (input: {
  values: string[];
  expectedPath: string;
  message: string;
}): Finding[] => input.values.includes(input.expectedPath) ? [] : [createManifestFinding(input.message)];

const collectManifestFindings = async (): Promise<Finding[]> => {
  if (!(await fileExists(pathFromRepoRoot(MANIFEST_FILE)))) {
    return [];
  }

  const manifest = await readJsonFile<KernelManifest>(pathFromRepoRoot(MANIFEST_FILE));
  return [
    ...(manifest.inspectorId === "kernel-owner" ? [] : [createManifestFinding("Kernel manifest inspectorId must remain kernel-owner.")]),
    ...(manifest.capabilityDomain === "kernel" ? [] : [createManifestFinding("Kernel manifest capabilityDomain must remain kernel.")]),
    ...(manifest.entry === INSPECTOR_ENTRY ? [] : [createManifestFinding("Kernel manifest entry must point at the kernel inspector.")]),
    ...collectManifestReadFindings({ values: manifest.readsLawFiles ?? [], expectedPath: KERNEL_FILE, message: "Kernel manifest must read the kernel law file." }),
    ...collectManifestReadFindings({ values: manifest.readsBlueprintFiles ?? [], expectedPath: BLUEPRINT_FILE, message: "Kernel manifest must read the frozen baseline blueprint." }),
    ...collectManifestReadFindings({ values: manifest.readsBlueprintFiles ?? [], expectedPath: PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE, message: "Kernel manifest must read the prompt contract governance blueprint." }),
  ];
};

const collectAuditScriptFindings = async (): Promise<Finding[]> => {
  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  return packageJson.scripts?.["audit:kernel"]
    ? []
    : [createFinding({
        lawId: REQUIREMENT_ID_001,
        file: "package.json",
        line: 1,
        severity: "fatal",
        message: "package.json must expose audit:kernel for the kernel routing owner.",
      })];
};

export async function runKernelOwnerSurfaceChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings = [
    ...await collectRequiredFileFindings(),
    ...await collectManifestFindings(),
    ...await collectAuditScriptFindings(),
  ];

  return {
    findings,
    phases: [
      createPhase(
        "owner-surface",
        findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
        findings.length === 0,
        findings.length === 0
          ? "Kernel routing owner has its manifest, run-inspector, negative-proof harness, and audit script wired."
          : "Kernel routing owner surface is incomplete or drifted.",
      ),
    ],
  };
}