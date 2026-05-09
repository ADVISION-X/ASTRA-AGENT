import { readJsonFile, writeJsonFile } from "./filesystem.js";
import { getRegisteredInspector } from "./inspector-registry.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { shouldBypassDefaultNegativeProofSkips } from "./nested-negative-proof.js";
import { defaultPhaseGatePath, repoRoot } from "./path-roots.js";
import path from "node:path";
import type {
  AuditConflictsSnapshot,
  AuditPlan,
  GeneratedArtifacts,
  GeneratedLawRegistry,
  PhaseGate,
} from "./schema-generated-artifacts.js";
import type { EnforcementMatrix } from "./schema-manifests.js";
import type { RunnerSummary } from "./schema-runner.js";
import type { DomainInspector, InspectorContext } from "./schema.js";
import { loadDomainManifests } from "./manifests.js";

const PRODUCTION_MUTATION_NEGATIVE_PROOF_SKIP_ENV = [
  "GRASSEYE_SKIP_AI_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY",
  "GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_COMMANDER_STARTUP_EXIT_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_INDEX_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_KERNEL_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_MAP_PLUGIN_ORCH_INTEGRATION_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_STRUCTURED_LOGGING_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF",
  "GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF",
] as const;

const RUN_NEGATIVE_PROOF_ENV = "GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF";

const applyProductionMutationNegativeProofBan = (): void => {
	if (process.env[RUN_NEGATIVE_PROOF_ENV] === "1") {
		return;
	}

  if (shouldBypassDefaultNegativeProofSkips()) {
    for (const envName of PRODUCTION_MUTATION_NEGATIVE_PROOF_SKIP_ENV) {
      delete process.env[envName];
    }
    return;
  }

  for (const envName of PRODUCTION_MUTATION_NEGATIVE_PROOF_SKIP_ENV) {
    process.env[envName] = "1";
  }
};

applyProductionMutationNegativeProofBan();

export const loadGeneratedArtifacts = async (): Promise<GeneratedArtifacts> => {
  const [lawRegistry, enforcementMatrix, auditPlan, auditConflicts, phaseGate] = await Promise.all([
    readJsonFile<GeneratedLawRegistry>(generatedArtifactPaths.lawRegistry),
    readJsonFile<EnforcementMatrix>(generatedArtifactPaths.enforcementMatrixJson),
    readJsonFile<AuditPlan>(generatedArtifactPaths.auditPlan),
    readJsonFile<AuditConflictsSnapshot>(generatedArtifactPaths.auditConflicts),
    readJsonFile<PhaseGate>(defaultPhaseGatePath),
  ]);

  return {
    lawRegistry,
    enforcementMatrix,
    auditPlan,
    auditConflicts,
    phaseGate,
  };
};

export const createInspectorContext = async (artifacts: GeneratedArtifacts): Promise<InspectorContext> => {
  const manifests = await loadDomainManifests();

  return {
    ...artifacts,
    repoRoot,
    manifestsByDomain: new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest])),
    matrixOwnersByDomain: new Map(
      artifacts.enforcementMatrix.owners.map((owner) => [owner.capabilityDomain, owner]),
    ),
    planOwnersByDomain: new Map(artifacts.auditPlan.owners.map((owner) => [owner.capabilityDomain, owner])),
  };
};

export const loadInspector = async (entry: string): Promise<DomainInspector> => {
  const inspector = getRegisteredInspector(entry);
  if (inspector === null) {
    throw new Error(`Inspector entry ${entry} is not registered in the static audit inspector registry.`);
  }

  return inspector;
};

export const writeRunnerSummary = async (summary: RunnerSummary): Promise<void> => {
  await writeJsonFile(generatedArtifactPaths.runnerSummary, summary);
};

export const writeDomainRunnerSummary = async (
  capabilityDomain: string,
  summary: RunnerSummary,
): Promise<void> => {
  await writeJsonFile(
    path.join(generatedArtifactPaths.domainSummariesHome, `${capabilityDomain}.json`),
    summary,
  );
};

const STANDALONE_HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Wraps a promise with a 5s heartbeat log, for use in standalone run-inspector.ts scripts.
 * Does NOT apply a timeout — the caller is responsible for that if needed.
 */
export const runWithStandaloneHeartbeat = async <T>(label: string, task: Promise<T>): Promise<T> => {
  const startMs = Date.now();
  const heartbeatHandle = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    process.stdout.write(`[AUDIT] ⏳ ${label} still running... (${elapsed}s elapsed)\n`);
  }, STANDALONE_HEARTBEAT_INTERVAL_MS);
  try {
    return await task;
  } finally {
    clearInterval(heartbeatHandle);
  }
};
