import { fileExists, writeJsonFile, writeTextFile } from "./core/filesystem.js";
import { parseModuleLaws } from "./core/law-parser.js";
import { loadDomainManifests } from "./core/manifests.js";
import {
  defaultPhaseGatePath,
  generatedArtifactPaths,
  pathFromRepoRoot,
  toRepoRelativePath,
} from "./core/paths.js";
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
import { REQUIRED_PHASE_DOMAINS } from "./core/required-phase-domains.js";
import { stringifyYaml } from "./core/yaml.js";

const collectManifestConflicts = async (
  laws: LawRecord[],
  manifests: Awaited<ReturnType<typeof loadDomainManifests>>,
  phaseGate: PhaseGate,
): Promise<AuditConflict[]> => {
  const conflicts: AuditConflict[] = [];
  const lawsByDomain = new Map<string, LawRecord[]>();

  for (const law of laws) {
    const existing = lawsByDomain.get(law.capabilityDomain) ?? [];
    existing.push(law);
    lawsByDomain.set(law.capabilityDomain, existing);
  }

  const manifestsByDomain = new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest]));

  for (const law of laws) {
    if (!law.lawId.startsWith("GRASSEYE-")) {
      conflicts.push({
        kind: "LAW_REGISTRY",
        message: "Law ID must use the GRASSEYE- prefix.",
        lawId: law.lawId,
        file: law.relativeFilePath,
        capabilityDomain: law.capabilityDomain,
      });
    }
  }

  for (const lawDomain of lawsByDomain.keys()) {
    if (!manifestsByDomain.has(lawDomain)) {
      conflicts.push({
        kind: "MANIFEST",
        message: "Active capability domain has no owner manifest.",
        capabilityDomain: lawDomain,
      });
    }
  }

  for (const activeDomain of phaseGate.activeCapabilityDomains) {
    if (!manifestsByDomain.has(activeDomain)) {
      conflicts.push({
        kind: "PLAN",
        message: "Phase gate references a capability domain without a manifest.",
        capabilityDomain: activeDomain,
      });
    }

    if (!lawsByDomain.has(activeDomain)) {
      conflicts.push({
        kind: "PLAN",
        message: "Phase gate references a capability domain without an active law.",
        capabilityDomain: activeDomain,
      });
    }
  }

  for (const requiredDomain of REQUIRED_PHASE_DOMAINS) {
    if (!phaseGate.activeCapabilityDomains.includes(requiredDomain)) {
      conflicts.push({
        kind: "PHASE_GATE",
        message: "Current frozen phase gate is missing a required capability domain.",
        capabilityDomain: requiredDomain,
        file: toRepoRelativePath(defaultPhaseGatePath),
      });
    }
  }

  for (const manifest of manifests) {
    const domainLaws = lawsByDomain.get(manifest.capabilityDomain) ?? [];
    const domainLawIds = new Set(domainLaws.map((law) => law.lawId));
    const domainLawFiles = new Set(domainLaws.map((law) => law.relativeFilePath));

    if (manifest.domainFolder !== manifest.capabilityDomain) {
      conflicts.push({
        kind: "MANIFEST",
        message: "Manifest capabilityDomain does not match its folder name.",
        capabilityDomain: manifest.capabilityDomain,
        file: manifest.manifestPath,
      });
    }

    if (!manifest.owner) {
      conflicts.push({
        kind: "MANIFEST",
        message: "Manifest must declare owner: true.",
        capabilityDomain: manifest.capabilityDomain,
        file: manifest.manifestPath,
      });
    }

    if (!(await fileExists(pathFromRepoRoot(manifest.entry)))) {
      conflicts.push({
        kind: "MANIFEST",
        message: "Manifest entry file does not exist.",
        capabilityDomain: manifest.capabilityDomain,
        file: manifest.entry,
      });
    }

    for (const allowedLawId of manifest.allowedLawIds) {
      if (!domainLawIds.has(allowedLawId)) {
        conflicts.push({
          kind: "MANIFEST",
          message: "Manifest declares a lawId that is not active for this capability domain.",
          capabilityDomain: manifest.capabilityDomain,
          lawId: allowedLawId,
          file: manifest.manifestPath,
        });
      }
    }

    for (const lawId of domainLawIds) {
      if (!manifest.allowedLawIds.includes(lawId)) {
        conflicts.push({
          kind: "MANIFEST",
          message: "Manifest is missing an active lawId for its capability domain.",
          capabilityDomain: manifest.capabilityDomain,
          lawId,
          file: manifest.manifestPath,
        });
      }
    }

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
  }

  return conflicts;
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

  const manifestConflicts = await collectManifestConflicts(laws, manifests, phaseGate);
  const lawsByDomain = new Map<string, LawRecord[]>();
  for (const law of laws) {
    const existing = lawsByDomain.get(law.capabilityDomain) ?? [];
    existing.push(law);
    lawsByDomain.set(law.capabilityDomain, existing);
  }

  const owners: EnforcementMatrixOwner[] = manifests.map((manifest) => ({
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

  const ownerByDomain = new Map(owners.map((owner) => [owner.capabilityDomain, owner]));
  const auditPlanOwners = phaseGate.activeCapabilityDomains.flatMap((capabilityDomain) => {
    const owner = ownerByDomain.get(capabilityDomain);
    if (!owner) {
      return [];
    }

    return [
      {
        capabilityDomain,
        inspectorId: owner.inspectorId,
        entry: owner.entry,
        lawIds: owner.lawIds,
      },
    ];
  });

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

  const plannedDomains = new Set(auditPlanOwners.map((owner) => owner.capabilityDomain));
  for (const requiredDomain of REQUIRED_PHASE_DOMAINS) {
    if (!plannedDomains.has(requiredDomain)) {
      auditConflicts.conflicts.push({
        kind: "PLAN",
        message: "Generated audit plan is missing a required capability domain.",
        capabilityDomain: requiredDomain,
        file: toRepoRelativePath(generatedArtifactPaths.auditPlan),
      });
    }
  }

  await Promise.all([
    writeJsonFile(generatedArtifactPaths.lawRegistry, lawRegistry),
    writeJsonFile(generatedArtifactPaths.enforcementMatrixJson, enforcementMatrix),
    writeTextFile(generatedArtifactPaths.enforcementMatrixYaml, `${stringifyYaml(enforcementMatrix)}\n`),
    writeJsonFile(generatedArtifactPaths.auditPlan, auditPlan),
    writeJsonFile(generatedArtifactPaths.auditConflicts, auditConflicts),
  ]);

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
    process.exitCode = 1;
  }
};

void main();