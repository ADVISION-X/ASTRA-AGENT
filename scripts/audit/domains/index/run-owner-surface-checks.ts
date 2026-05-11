import { fileExists, readJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";

import { indexInspectionConstants } from "./inspection-constants.js";

type IndexManifest = {
  inspectorId?: string;
  capabilityDomain?: string;
  entry?: string;
  readsLawFiles?: string[];
  readsBlueprintFiles?: string[];
};

const {
  BLUEPRINT_FILE,
  CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE,
  INSPECTOR_ENTRY,
  INDEX_FILE,
  KERNEL_FILE,
  MANIFEST_FILE,
  MUSCLE_MEMORY_BLUEPRINT_FILE,
  REQUIREMENT_ID_001,
  RUN_INSPECTOR_FILE,
} = indexInspectionConstants;

const addMissingFileFinding = (findings: Finding[], file: string, message: string): void => {
  findings.push(createFinding({
    lawId: REQUIREMENT_ID_001,
    file,
    line: 1,
    severity: "fatal",
    message,
  }));
};

const collectRequiredFileFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];

  if (!(await fileExists(pathFromRepoRoot(MANIFEST_FILE)))) {
    addMissingFileFinding(findings, MANIFEST_FILE, "Index routing owner manifest is missing.");
  }
  if (!(await fileExists(pathFromRepoRoot(RUN_INSPECTOR_FILE)))) {
    addMissingFileFinding(findings, RUN_INSPECTOR_FILE, "Index routing run-inspector entry is missing.");
  }
  return findings;
};

const createManifestFinding = (message: string): Finding =>
  createFinding({ lawId: REQUIREMENT_ID_001, file: MANIFEST_FILE, line: 1, severity: "error", message });

const collectManifestReadFindings = (input: {
  values: string[];
  expectedPath: string;
  message: string;
}): Finding[] => input.values.includes(input.expectedPath) ? [] : [createManifestFinding(input.message)];

const collectManifestFindings = async (): Promise<Finding[]> => {
  if (!(await fileExists(pathFromRepoRoot(MANIFEST_FILE)))) {
    return [];
  }

  const manifest = await readJsonFile<IndexManifest>(pathFromRepoRoot(MANIFEST_FILE));

  return [
    ...(manifest.inspectorId === "index-owner" ? [] : [createManifestFinding("Index manifest inspectorId must remain index-owner.")]),
    ...(manifest.capabilityDomain === "index" ? [] : [createManifestFinding("Index manifest capabilityDomain must remain index.")]),
    ...(manifest.entry === INSPECTOR_ENTRY ? [] : [createManifestFinding("Index manifest entry must point at the index inspector.")]),
    ...collectManifestReadFindings({ values: manifest.readsLawFiles ?? [], expectedPath: KERNEL_FILE, message: "Index manifest must read the kernel routing law file." }),
    ...collectManifestReadFindings({ values: manifest.readsLawFiles ?? [], expectedPath: INDEX_FILE, message: "Index manifest must read the index routing law file." }),
    ...collectManifestReadFindings({ values: manifest.readsBlueprintFiles ?? [], expectedPath: BLUEPRINT_FILE, message: "Index manifest must read the simple capability-machine blueprint file." }),
    ...collectManifestReadFindings({ values: manifest.readsBlueprintFiles ?? [], expectedPath: MUSCLE_MEMORY_BLUEPRINT_FILE, message: "Index manifest must read the MuscleMemory capability-registry blueprint file." }),
    ...collectManifestReadFindings({ values: manifest.readsBlueprintFiles ?? [], expectedPath: CHILD_CAPABILITY_STRENGTH_BLUEPRINT_FILE, message: "Index manifest must read the child-capability-strength blueprint file." }),
  ];
};

export async function runIndexOwnerSurfaceChecks(
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const findings = [
    ...(await collectRequiredFileFindings()),
    ...(await collectManifestFindings()),
  ];

  if (!context.matrixOwnersByDomain.get("index")) {
    findings.push(createFinding({
      lawId: REQUIREMENT_ID_001,
      file: MANIFEST_FILE,
      line: 1,
      severity: "fatal",
      message: "Generated enforcement matrix must include the index routing owner.",
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
          ? "Index routing owner has its manifest, run-inspector, matrix wiring, and audit script wired."
          : "Index routing owner surface is incomplete or drifted.",
      ),
    ],
  };
}
