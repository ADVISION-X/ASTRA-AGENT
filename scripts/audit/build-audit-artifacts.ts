import { fileExists, writeJsonFile, writeTextFile } from "./core/filesystem.js";
import { fileURLToPath } from "node:url";
import { parseModuleLaws } from "./core/law-parser.js";
import { loadDomainManifests } from "./core/manifests.js";
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
  EnforcementMatrix,
  EnforcementMatrixOwner,
  GeneratedLawRegistry,
  LawRecord,
  PhaseGate,
} from "./core/schema.js";
import { readJsonFile } from "./core/filesystem.js";
import { loadFrozenBaselineDomains } from "./core/frozen-baseline.js";
import { stringifyYaml } from "./core/yaml.js";

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
      conflicts.push({ kind: "MANIFEST", message: "Active capability domain has no owner manifest.", capabilityDomain: lawDomain });
    }

    if (!context.phaseGate.activeCapabilityDomains.includes(lawDomain)) {
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

  for (const activeDomain of context.phaseGate.activeCapabilityDomains) {
    if (!context.manifestsByDomain.has(activeDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate references a capability domain without a manifest.", capabilityDomain: activeDomain });
    }

    if (!context.lawsByDomain.has(activeDomain)) {
      conflicts.push({ kind: "PLAN", message: "Phase gate references a capability domain without an active law.", capabilityDomain: activeDomain });
    }
  }

  for (const requiredDomain of context.requiredPhaseDomains) {
    if (!context.phaseGate.activeCapabilityDomains.includes(requiredDomain)) {
      conflicts.push({
        kind: "PHASE_GATE",
        message: "Current frozen phase gate is missing a required capability domain.",
        capabilityDomain: requiredDomain,
        file: toRepoRelativePath(defaultPhaseGatePath),
      });
    }
  }

  for (const deletedOwnerDomain of context.deletedOwnerDomains) {
    if (context.phaseGate.activeCapabilityDomains.includes(deletedOwnerDomain)) {
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
    requiredPhaseDomains: frozenBaseline.activeCapabilityDomains,
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

const buildAuditPlanOwners = (owners: EnforcementMatrixOwner[], activeCapabilityDomains: string[]) => {
  const ownerByDomain = new Map(owners.map((owner) => [owner.capabilityDomain, owner]));
  return activeCapabilityDomains.flatMap((capabilityDomain) => {
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

  for (const requiredDomain of frozenBaseline.activeCapabilityDomains) {
    if (!plannedDomains.has(requiredDomain)) {
      auditConflicts.conflicts.push({ kind: "PLAN", message: "Generated audit plan is missing a required capability domain.", capabilityDomain: requiredDomain, file: toRepoRelativePath(generatedArtifactPaths.auditPlan) });
    }
  }

  for (const deletedOwnerDomain of frozenBaseline.deletedOwnerDomains) {
    if (plannedDomains.has(deletedOwnerDomain)) {
      auditConflicts.conflicts.push({ kind: "PLAN", message: "Generated audit plan must not reactivate a deleted owner domain.", capabilityDomain: deletedOwnerDomain, file: toRepoRelativePath(generatedArtifactPaths.auditPlan) });
    }
  }
};

const writeGeneratedArtifacts = async (
  lawRegistry: GeneratedLawRegistry,
  enforcementMatrix: EnforcementMatrix,
  auditPlan: AuditPlan,
  auditConflicts: AuditConflictsSnapshot,
): Promise<void> => {
  await Promise.all([
    writeJsonFile(generatedArtifactPaths.lawRegistry, lawRegistry),
    writeJsonFile(generatedArtifactPaths.enforcementMatrixJson, enforcementMatrix),
    writeTextFile(generatedArtifactPaths.enforcementMatrixYaml, `${stringifyYaml(enforcementMatrix)}\n`),
    writeJsonFile(generatedArtifactPaths.auditPlan, auditPlan),
    writeJsonFile(generatedArtifactPaths.auditConflicts, auditConflicts),
  ]);
};

export const buildAuditArtifacts = async (): Promise<{
  generatedAt: string;
  lawRegistry: GeneratedLawRegistry;
  enforcementMatrix: EnforcementMatrix;
  auditPlan: AuditPlan;
  auditConflicts: AuditConflictsSnapshot;
}> => {
  const generatedAt = new Date().toISOString();
  const { laws, conflicts: lawConflicts } = await parseModuleLaws();
  const manifests = await loadDomainManifests();
  const phaseGate = await readJsonFile<PhaseGate>(defaultPhaseGatePath);
  const frozenBaseline = await loadFrozenBaselineDomains();

  const manifestConflicts = await collectManifestConflicts(laws, manifests, phaseGate);
  const lawsByDomain = groupLawsByDomain(laws);
  const owners = buildEnforcementMatrixOwners(manifests, lawsByDomain);
  const auditPlanOwners = buildAuditPlanOwners(owners, phaseGate.activeCapabilityDomains);

  const lawRegistry: GeneratedLawRegistry = {
    generatedAt,
    laws,
  };

  const enforcementMatrix: EnforcementMatrix = {
    generatedAt,
    owners,
  };

  const auditPlan: AuditPlan = {
    generatedAt,
    phase: phaseGate.phase,
    phaseGateFile: toRepoRelativePath(defaultPhaseGatePath),
    owners: auditPlanOwners,
  };

  const auditConflicts: AuditConflictsSnapshot = {
    generatedAt,
    conflicts: [...lawConflicts, ...manifestConflicts],
  };

  appendFrozenPlanConflicts(auditConflicts, auditPlanOwners, frozenBaseline);
  await writeGeneratedArtifacts(lawRegistry, enforcementMatrix, auditPlan, auditConflicts);

  return {
    generatedAt,
    lawRegistry,
    enforcementMatrix,
    auditPlan,
    auditConflicts,
  };
};

const main = async (): Promise<void> => {
  const artifacts = await buildAuditArtifacts();
  for (const conflict of artifacts.auditConflicts.conflicts) {
    process.stderr.write(
      `[AUDIT-BUILD-CONFLICT] ${conflict.kind} ${conflict.capabilityDomain ?? "unknown-domain"} ${conflict.lawId ?? "no-law-id"}: ${conflict.message}\n`,
    );
  }
  process.stdout.write(
    `Generated ${artifacts.lawRegistry.laws.length} active laws, ${artifacts.enforcementMatrix.owners.length} owners, ${artifacts.auditPlan.owners.length} planned inspections, ${artifacts.auditConflicts.conflicts.length} conflicts.\n`,
  );
  if (artifacts.auditConflicts.conflicts.length > 0) {
    process.exit(1);
  }
  process.stdout.write("[AUDIT-BUILD PASS] generated artifacts with zero conflicts.\n");
  process.exit(0);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[AUDIT-BUILD ERROR] ${message}\n`);
    process.exit(1);
  });
}
