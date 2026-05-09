import { readJsonFile, writeJsonFile } from "./filesystem.js";
import { getRegisteredInspector } from "./inspector-registry.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
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
