import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import type { ResolvedDomainManifest } from "../../core/schema-manifests.js";

export type DomainOwnerInspectionOptions = {
  capabilityDomain: string;
  inspectorId: string;
  inspectorEntry: string;
};

export type DomainOwnerInspectionResult = {
  manifest?: ResolvedDomainManifest;
  findings: Finding[];
  phases: InspectorPhase[];
};

export const createMissingManifestResult = (options: DomainOwnerInspectionOptions): DomainOwnerInspectionResult => ({
  findings: [
    createFinding({
      lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
      file: `scripts/audit/domains/${options.capabilityDomain}/manifest.json`,
      line: 1,
      severity: "fatal",
      message: "Owner manifest is missing for capability domain.",
      hint: "Create one manifest.json per capabilityDomain.",
    }),
  ],
  phases: [createPhase("owner-manifest", "LAW GAP", false, "Owner manifest is missing, so the domain cannot be enforced.")],
});

const collectManifestIdentityFindings = (
  manifest: ResolvedDomainManifest,
  options: DomainOwnerInspectionOptions,
): Finding[] => {
  const findings: Finding[] = [];

  if (manifest.inspectorId !== options.inspectorId) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "error", message: "Manifest inspectorId does not match the owner inspector." }));
  }

  if (manifest.capabilityDomain !== options.capabilityDomain) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Manifest capabilityDomain does not match inspector capabilityDomain." }));
  }

  if (manifest.entry !== options.inspectorEntry) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "error", message: "Manifest entry does not match the real inspector file." }));
  }

  if (!manifest.owner) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "error", message: "Manifest must declare owner: true." }));
  }

  return findings;
};

const getActiveDomainLawIds = (context: InspectorContext, capabilityDomain: string): string[] => context.lawRegistry.laws
  .filter((law) => law.capabilityDomain === capabilityDomain)
  .map((law) => law.lawId);

const collectReferencedFileFindings = async (
  manifest: ResolvedDomainManifest,
  hasActiveOwnedLaws: boolean,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  if (!(await fileExists(pathFromRepoRoot(manifest.entry)))) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.entry, line: 1, severity: "fatal", message: "Manifest entry file does not exist." }));
  }

  if (hasActiveOwnedLaws && manifest.readsLawFiles.length === 0) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "error", message: "Manifest must declare readsLawFiles for its owned laws." }));
  }

  findings.push(...await collectMissingReferenceFindings(manifest.readsLawFiles, "fatal", "Manifest references a law file that does not exist."));
  findings.push(...await collectMissingReferenceFindings(manifest.readsBlueprintFiles ?? [], "error", "Manifest references a blueprint file that does not exist."));
  return findings;
};

const collectMissingReferenceFindings = async (
  filePaths: string[],
  severity: "error" | "fatal",
  message: string,
): Promise<Finding[]> => {
  const findings: Finding[] = [];

  for (const filePath of filePaths) {
    if (!(await fileExists(pathFromRepoRoot(filePath)))) {
      findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: filePath, line: 1, severity, message }));
    }
  }

  return findings;
};

const collectAllowedLawFindings = (context: InspectorContext, manifest: ResolvedDomainManifest): Finding[] => {
  const activeLawIds = new Set(context.lawRegistry.laws.map((law) => law.lawId));
  return manifest.allowedLawIds
    .filter((allowedLawId) => !activeLawIds.has(allowedLawId))
    .map((allowedLawId) => createFinding({
      lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
      file: manifest.manifestPath,
      line: 1,
      severity: "error",
      message: "Manifest allowedLawIds references a non-existent active law.",
      detail: allowedLawId,
    }));
};

const collectGeneratedArtifactFindings = (
  context: InspectorContext,
  manifest: ResolvedDomainManifest,
  capabilityDomain: string,
  hasActiveOwnedLaws: boolean,
): Finding[] => {
  const findings: Finding[] = [];

  if (!context.matrixOwnersByDomain.get(capabilityDomain)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Generated enforcement matrix does not contain this owner." }));
  }

  if (hasActiveOwnedLaws && !context.planOwnersByDomain.get(capabilityDomain)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1", file: manifest.manifestPath, line: 1, severity: "fatal", message: "Generated audit plan does not contain this owner." }));
  }

  return findings;
};

export const collectDomainOwnerInspectionFindings = async (
  context: InspectorContext,
  manifest: ResolvedDomainManifest,
  options: DomainOwnerInspectionOptions,
): Promise<Finding[]> => {
  const activeDomainLawIds = getActiveDomainLawIds(context, options.capabilityDomain);
  const hasActiveOwnedLaws = activeDomainLawIds.length > 0;

  return [
    ...collectManifestIdentityFindings(manifest, options),
    ...await collectReferencedFileFindings(manifest, hasActiveOwnedLaws),
    ...collectAllowedLawFindings(context, manifest),
    ...collectGeneratedArtifactFindings(context, manifest, options.capabilityDomain, hasActiveOwnedLaws),
  ];
};

export const createOwnerFoundationPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "owner-foundation",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Manifest, generated matrix, and generated audit plan agree on this owner."
      : "Owner foundation has manifest or generated-artifact drift.",
  );