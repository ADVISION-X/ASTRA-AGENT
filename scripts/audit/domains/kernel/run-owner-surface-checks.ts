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

export async function runKernelOwnerSurfaceChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
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

  if (await fileExists(pathFromRepoRoot(MANIFEST_FILE))) {
    const manifest = await readJsonFile<KernelManifest>(pathFromRepoRoot(MANIFEST_FILE));
    if (manifest.inspectorId !== "kernel-owner") {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest inspectorId must remain kernel-owner." }));
    }
    if (manifest.capabilityDomain !== "kernel") {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest capabilityDomain must remain kernel." }));
    }
    if (manifest.entry !== INSPECTOR_ENTRY) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest entry must point at the kernel inspector." }));
    }
    if (!(manifest.readsLawFiles ?? []).includes(KERNEL_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest must read the kernel law file." }));
    }
    if (!(manifest.readsBlueprintFiles ?? []).includes(BLUEPRINT_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest must read the frozen baseline blueprint." }));
    }
    if (!(manifest.readsBlueprintFiles ?? []).includes(PROMPT_CONTRACT_GOVERNANCE_BLUEPRINT_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Kernel manifest must read the prompt contract governance blueprint." }));
    }
  }

  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  if (!packageJson.scripts?.["audit:kernel"]) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: "package.json",
      line: 1,
      severity: "fatal",
      message: "package.json must expose audit:kernel for the kernel routing owner.",
    }));
  }

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