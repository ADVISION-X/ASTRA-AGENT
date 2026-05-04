import { fileExists } from "./core/filesystem.js";
import { parseModuleLaws } from "./core/law-parser.js";
import { loadDomainManifests } from "./core/manifests.js";
import { collectTouchedFilesArtifact } from "./core/touched-files-collector.js";
import {
  pathFromRepoRoot,
  toRepoRelativePath,
} from "./core/paths.js";
import { generatedArtifactPaths } from "./core/generated-artifact-paths.js";
import { defaultPhaseGatePath } from "./core/path-roots.js";
import type {
  AuditConflict,
  AuditConflictsSnapshot,
  AuditPlan,
  GeneratedLawRegistry,
  LawRecord,
  PhaseGate,
} from "./core/schema-generated-artifacts.js";
import type { EnforcementMatrix, EnforcementMatrixOwner } from "./core/schema-manifests.js";
import { readJsonFile } from "./core/filesystem.js";
import { loadFrozenBaselineDomains } from "./core/frozen-baseline.js";
import { writeGeneratedArtifacts, type GeneratedArtifactsWriteInput } from "./core/artifact-writers.js";

type ManifestCollectionContext = {
  lawsByDomain: Map<string, LawRecord[]>;
  manifestsByDomain: Map<string, Awaited<ReturnType<typeof loadDomainManifests>>[number]>;
  phaseGate: PhaseGate;
  requiredPhaseDomains: string[];
  deletedOwnerDomains: string[];
};

const groupLawsByDomain = (laws: LawRecord[]): Map<string, LawRecord[]> => {
  const lawsByDomain = new Map<string, LawRecord[]>();
  for (const law of laws) {
    const existing = lawsByDomain.get(law.capabilityDomain) ?? [];
    existing.push(law);
    lawsByDomain.set(law.capabilityDomain, existing);
  }

  return lawsByDomain;
};

const collectLawRegistryConflicts = (laws: LawRecord[]): AuditConflict[] =>
  laws
    .filter((law) => !law.lawId.startsWith("GRASSEYE-"))
    .map((law) => ({
      kind: "LAW_REGISTRY",
      message: "Law ID must use the GRASSEYE- prefix.",
      lawId: law.lawId,
      file: law.relativeFilePath,
      capabilityDomain: law.capabilityDomain,
    }));

const collectActiveDomainConflicts = (context: ManifestCollectionContext): AuditConflict[] => {
  const conflicts: AuditConflict[] = [];

  for (const lawDomain of context.lawsByDomain.keys()) {
    if (!context.manifestsByDomain.has(lawDomain)) {
      conflicts.push({ kind: "MANIFEST", message: "Active law domain has no owner manifest.", capabilityDomain: lawDomain });
    }

    if (!context.phaseGate.activeLawDomains.includes(lawDomain)) {
      conflicts.push({
        kind: "PHASE_GATE",
        message: "Active law domain is not enabled in the current phase gate.",
        capabilityDomain: lawDomain,
        file: toRepoRelativePath(defaultPhaseGatePath),
      });
    }
  }

  return conflicts;
};

const collectPhaseGateConflicts = (context: ManifestCollectionContext): AuditConflict[] => {
  const conflicts: AuditConflict[] = [];

  for (const activeDomain of context.phaseGate.activeLawDomains) {
    if (!context.manifestsByDomain.has(activeDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate references a law domain without a manifest.", capabilityDomain: activeDomain });
    }

    if (!context.lawsByDomain.has(activeDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate references a law domain without an active law.", capabilityDomain: activeDomain });
    }
  }

  for (const requiredDomain of context.requiredPhaseDomains) {
    if (!context.phaseGate.activeLawDomains.includes(requiredDomain)) {
      conflicts.push({
        kind: "PHASE_GATE",
        message: "Current frozen phase gate is missing a required law domain.",
        capabilityDomain: requiredDomain,
        file: toRepoRelativePath(defaultPhaseGatePath),
      });
    }
  }

  for (const deletedOwnerDomain of context.deletedOwnerDomains) {
    if (context.phaseGate.activeLawDomains.includes(deletedOwnerDomain)) {
      conflicts.push({
        kind: "PHASE_GATE",
        message: "Current frozen phase gate must not reactivate a deleted owner domain.",
        capabilityDomain: deletedOwnerDomain,
        file: toRepoRelativePath(defaultPhaseGatePath),
      });
    }
  }

  return conflicts;
};

const collectManifestLawConflicts = async (
  manifests: Awaited<ReturnType<typeof loadDomainManifests>>,
  lawsByDomain: Map<string, LawRecord[]>,
): Promise<AuditConflict[]> => {
  const conflicts: AuditConflict[] = [];

  for (const manifest of manifests) {
    const domainLaws = lawsByDomain.get(manifest.capabilityDomain) ?? [];
    const domainLawIds = new Set(domainLaws.map((law) => law.lawId));
    const domainLawFiles = new Set(domainLaws.map((law) => law.relativeFilePath));

    if (manifest.domainFolder !== manifest.capabilityDomain) {
      conflicts.push({ kind: "MANIFEST", message: "Manifest capabilityDomain does not match its folder name.", capabilityDomain: manifest.capabilityDomain, file: manifest.manifestPath });
    }

    if (!manifest.owner) {
      conflicts.push({ kind: "MANIFEST", message: "Manifest must declare owner: true.", capabilityDomain: manifest.capabilityDomain, file: manifest.manifestPath });
    }

    if (!(await fileExists(pathFromRepoRoot(manifest.entry)))) {
      conflicts.push({ kind: "MANIFEST", message: "Manifest entry file does not exist.", capabilityDomain: manifest.capabilityDomain, file: manifest.entry });
    }

    conflicts.push(...collectAllowedLawConflicts(manifest, domainLawIds));
    conflicts.push(...collectDomainLawFileConflicts(manifest, domainLawIds, domainLawFiles));
  }

  return conflicts;
};

const collectAllowedLawConflicts = (
  manifest: Awaited<ReturnType<typeof loadDomainManifests>>[number],
  domainLawIds: Set<string>,
): AuditConflict[] => {
  const conflicts: AuditConflict[] = [];

  for (const allowedLawId of manifest.allowedLawIds) {
    if (!domainLawIds.has(allowedLawId)) {
      conflicts.push({ kind: "MANIFEST", message: "Manifest declares a lawId that is not active for this capability domain.", capabilityDomain: manifest.capabilityDomain, lawId: allowedLawId, file: manifest.manifestPath });
    }
  }

  for (const lawId of domainLawIds) {
    if (!manifest.allowedLawIds.includes(lawId)) {
      conflicts.push({ kind: "MANIFEST", message: "Manifest is missing an active lawId for its capability domain.", capabilityDomain: manifest.capabilityDomain, lawId, file: manifest.manifestPath });
    }
  }

  return conflicts;
};

const collectDomainLawFileConflicts = (
  manifest: Awaited<ReturnType<typeof loadDomainManifests>>[number],
  domainLawIds: Set<string>,
  domainLawFiles: Set<string>,
): AuditConflict[] => {
  const conflicts: AuditConflict[] = [];

  for (const lawFile of domainLawFiles) {
    if (!manifest.readsLawFiles.includes(lawFile)) {
      conflicts.push({
        kind: "MANIFEST",
        message: "Manifest readsLawFiles is missing an owned law file.",
        capabilityDomain: manifest.capabilityDomain,
        file: manifest.manifestPath,
        detail: lawFile,
      });
    }
  }

  if (domainLawIds.size === 0) {
    return conflicts;
  }

  return conflicts;
};

const collectManifestConflicts = async (
  laws: LawRecord[],
  manifests: Awaited<ReturnType<typeof loadDomainManifests>>,
  phaseGate: PhaseGate,
): Promise<AuditConflict[]> => {
  const frozenBaseline = await loadFrozenBaselineDomains();
  const context: ManifestCollectionContext = {
    lawsByDomain: groupLawsByDomain(laws),
    manifestsByDomain: new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest])),
    phaseGate,
    requiredPhaseDomains: frozenBaseline.activeLawDomains,
    deletedOwnerDomains: frozenBaseline.deletedOwnerDomains,
  };

  return [
    ...collectLawRegistryConflicts(laws),
    ...collectActiveDomainConflicts(context),
    ...collectPhaseGateConflicts(context),
    ...await collectManifestLawConflicts(manifests, context.lawsByDomain),
  ];
};

const buildEnforcementMatrixOwners = (
  manifests: Awaited<ReturnType<typeof loadDomainManifests>>,
  lawsByDomain: Map<string, LawRecord[]>,
): EnforcementMatrixOwner[] => manifests.map((manifest) => ({
  inspectorId: manifest.inspectorId,
  capabilityDomain: manifest.capabilityDomain,
  manifestPath: manifest.manifestPath,
  entry: manifest.entry,
  engine: manifest.engine,
  supportsEvidenceModes: manifest.supportsEvidenceModes,
  lawIds: (lawsByDomain.get(manifest.capabilityDomain) ?? []).map((law) => law.lawId),
  readsLawFiles: manifest.readsLawFiles,
  readsBlueprintFiles: manifest.readsBlueprintFiles ?? [],
}));

const buildAuditPlanOwners = (owners: EnforcementMatrixOwner[], activeLawDomains: string[]) => {
  const ownerByDomain = new Map(owners.map((owner) => [owner.capabilityDomain, owner]));
  return activeLawDomains.flatMap((capabilityDomain) => {
    const owner = ownerByDomain.get(capabilityDomain);
    return owner
      ? [{ capabilityDomain, inspectorId: owner.inspectorId, entry: owner.entry, lawIds: owner.lawIds }]
      : [];
  });
};

const appendFrozenPlanConflicts = (
  auditConflicts: AuditConflictsSnapshot,
  auditPlanOwners: AuditPlan["owners"],
  frozenBaseline: Awaited<ReturnType<typeof loadFrozenBaselineDomains>>,
): void => {
  const plannedDomains = new Set(auditPlanOwners.map((owner) => owner.capabilityDomain));

  for (const requiredDomain of frozenBaseline.activeLawDomains) {
    if (!plannedDomains.has(requiredDomain)) {
      auditConflicts.conflicts.push({ kind: "PLAN", message: "Generated audit plan is missing a required law domain.", capabilityDomain: requiredDomain, file: toRepoRelativePath(generatedArtifactPaths.auditPlan) });
    }
  }

  for (const deletedOwnerDomain of frozenBaseline.deletedOwnerDomains) {
    if (plannedDomains.has(deletedOwnerDomain)) {
      auditConflicts.conflicts.push({ kind: "PLAN", message: "Generated audit plan must not reactivate a deleted owner domain.", capabilityDomain: deletedOwnerDomain, file: toRepoRelativePath(generatedArtifactPaths.auditPlan) });
    }
  }
};

type BuiltAuditArtifacts = Omit<GeneratedArtifactsWriteInput, "touchedFilesArtifact">;

export const prepareAuditArtifactsSnapshot = async (): Promise<GeneratedArtifactsWriteInput> => {
  const generatedAt = new Date().toISOString();
  const { laws, conflicts: lawConflicts } = await parseModuleLaws();
  const manifests = await loadDomainManifests();
  const phaseGate = await readJsonFile<PhaseGate>(defaultPhaseGatePath);
  const frozenBaseline = await loadFrozenBaselineDomains();
  const touchedFilesArtifact = await collectTouchedFilesArtifact({ allowStatusFallback: true });
  const manifestConflicts = await collectManifestConflicts(laws, manifests, phaseGate);
  const lawsByDomain = groupLawsByDomain(laws);
  const owners = buildEnforcementMatrixOwners(manifests, lawsByDomain);
  const auditPlanOwners = buildAuditPlanOwners(owners, phaseGate.activeLawDomains);
  const auditConflicts: AuditConflictsSnapshot = {
    generatedAt,
    conflicts: [...lawConflicts, ...manifestConflicts],
  };

  appendFrozenPlanConflicts(auditConflicts, auditPlanOwners, frozenBaseline);
  return {
    touchedFilesArtifact,
    lawRegistry: { generatedAt, laws },
    enforcementMatrix: { generatedAt, owners },
    auditPlan: {
      generatedAt,
      phase: phaseGate.phase,
      phaseGateFile: toRepoRelativePath(defaultPhaseGatePath),
      owners: auditPlanOwners,
    },
    auditConflicts,
  };
};

const toBuiltAuditArtifacts = (input: GeneratedArtifactsWriteInput): BuiltAuditArtifacts => ({
  lawRegistry: input.lawRegistry,
  enforcementMatrix: input.enforcementMatrix,
  auditPlan: input.auditPlan,
  auditConflicts: input.auditConflicts,
});

export const buildAuditArtifacts = async (): Promise<{
  generatedAt: string;
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  auditConflicts: AuditConflictsSnapshot;
}> => {
  const generatedArtifacts = await prepareAuditArtifactsSnapshot();
  await writeGeneratedArtifacts(generatedArtifacts);

  return {
    generatedAt: generatedArtifacts.lawRegistry.generatedAt,
    ...toBuiltAuditArtifacts(generatedArtifacts),
  };
};
