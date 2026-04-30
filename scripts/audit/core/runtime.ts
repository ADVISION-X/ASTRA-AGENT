import { readJsonFile, writeJsonFile } from "./filesystem.js";
import { getRegisteredInspector } from "./inspector-registry.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import { defaultPhaseGatePath, repoRoot } from "./path-roots.js";
import type {
  AuditConflictsSnapshot,
  AuditPlan,
  DomainInspector,
  EnforcementMatrix,
  GeneratedArtifacts,
  GeneratedLawRegistry,
  InspectorContext,
  PhaseGate,
  RunnerSummary,
} from "./schema.js";
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