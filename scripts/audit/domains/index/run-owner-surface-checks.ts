import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { indexInspectionConstants } from "./inspection-constants.js";

type PackageJson = {
  scripts?: Record<string, string>;
};

type IndexManifest = {
  inspectorId?: string;
  capabilityDomain?: string;
  entry?: string;
  readsLawFiles?: string[];
  readsBlueprintFiles?: string[];
};

const {
  BLUEPRINT_FILE,
  INSPECTOR_ENTRY,
  INDEX_FILE,
  KERNEL_FILE,
  MANIFEST_FILE,
  NEGATIVE_PROOF_HARNESS_FILE,
  REQUIREMENT_ID_001,
  RUN_INSPECTOR_FILE,
} = indexInspectionConstants;
const STANDARD_PACKAGE_BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye_能力组标准包与执法结构统一施工图.md";

const EXPECTED_AUDIT_SCRIPT = "node --import tsx scripts/audit/domains/index/run-inspector.ts";

const addMissingFileFinding = (findings: Finding[], file: string, message: string): void => {
  findings.push(createFinding({
    lawId: REQUIREMENT_ID_001,
    file,
    line: 1,
    severity: "fatal",
    message,
  }));
};

export async function runIndexOwnerSurfaceChecks(
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings: Finding[] = [];

  if (!(await fileExists(pathFromRepoRoot(MANIFEST_FILE)))) {
    addMissingFileFinding(findings, MANIFEST_FILE, "Index routing owner manifest is missing.");
  }

  if (!(await fileExists(pathFromRepoRoot(RUN_INSPECTOR_FILE)))) {
    addMissingFileFinding(findings, RUN_INSPECTOR_FILE, "Index routing run-inspector entry is missing.");
  }

  if (!(await fileExists(pathFromRepoRoot(NEGATIVE_PROOF_HARNESS_FILE)))) {
    addMissingFileFinding(findings, NEGATIVE_PROOF_HARNESS_FILE, "Index routing negative-proof harness is missing.");
  }

  if (await fileExists(pathFromRepoRoot(MANIFEST_FILE))) {
    const manifest = await readJsonFile<IndexManifest>(pathFromRepoRoot(MANIFEST_FILE));
    if (manifest.inspectorId !== "index-owner") {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest inspectorId must remain index-owner." }));
    }
    if (manifest.capabilityDomain !== "index") {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest capabilityDomain must remain index." }));
    }
    if (manifest.entry !== INSPECTOR_ENTRY) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest entry must point at the index inspector." }));
    }
    if (!(manifest.readsLawFiles ?? []).includes(KERNEL_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest must read the kernel routing law file." }));
    }
    if (!(manifest.readsLawFiles ?? []).includes(INDEX_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest must read the index routing law file." }));
    }
    if (!(manifest.readsBlueprintFiles ?? []).includes(BLUEPRINT_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest must read the frozen baseline blueprint file." }));
    }
    if (!(manifest.readsBlueprintFiles ?? []).includes(STANDARD_PACKAGE_BLUEPRINT_FILE)) {
      findings.push(createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message: "Index manifest must read the standard package blueprint file." }));
    }
  }

  if (!context.matrixOwnersByDomain.get("index")) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: MANIFEST_FILE,
      line: 1,
      severity: "fatal",
      message: "Generated enforcement matrix must include the index routing owner.",
    }));
  }

  const packageJson = await readJsonFile<PackageJson>(pathFromRepoRoot("package.json"));
  const auditScript = packageJson.scripts?.["audit:index"];
  if (!auditScript) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: "package.json",
      line: 1,
      severity: "fatal",
      message: "package.json must expose audit:index for the index routing owner.",
    }));
  } else if (auditScript !== EXPECTED_AUDIT_SCRIPT) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: "package.json",
      line: 1,
      severity: "error",
      message: "package.json audit:index must execute the governed index run-inspector entry.",
      detail: auditScript,
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
          ? "Index routing owner has its manifest, run-inspector, negative-proof harness, matrix wiring, and audit script wired."
          : "Index routing owner surface is incomplete or drifted.",
      ),
    ],
  };
}