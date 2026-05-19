import { readGeneratedJson } from "../core/generated-artifact.js";
import type { LawRecord, OwnerManifest } from "../core/schema.js";

const activeLawCensusDrift = (laws: LawRecord[]): string[] => {
  try {
    const census = readGeneratedJson<{ laws?: Array<{ lawId: string }> }>("active-law-census.generated.json");
    const generatedLawIds = new Set((census.laws ?? []).map((law) => law.lawId));
    return laws
      .filter((law) => !generatedLawIds.has(law.lawId))
      .map((law) => `active-law-census missing ${law.lawId}`);
  } catch {
    return ["active-law-census.generated.json unreadable"];
  }
};

const ownerMatrixDrift = (manifests: OwnerManifest[]): string[] => {
  try {
    const matrix = readGeneratedJson<{ domains?: Array<{ capabilityDomain: string; lawIds: string[] }> }>("owner-inspector-matrix.generated.json");
    const domains = new Map((matrix.domains ?? []).map((domain) => [domain.capabilityDomain, new Set(domain.lawIds)]));
    return manifests.flatMap((manifest) => ownerManifestDrift(manifest, domains.get(manifest.capabilityDomain)));
  } catch {
    return ["owner-inspector-matrix.generated.json unreadable"];
  }
};

const ownerManifestDrift = (manifest: OwnerManifest, lawIds: Set<string> | undefined): string[] => {
  if (!lawIds) return [`owner-inspector-matrix missing ${manifest.capabilityDomain}`];
  return manifest.allowedLawIds
    .filter((lawId) => !lawIds.has(lawId))
    .map((lawId) => `owner-inspector-matrix missing ${manifest.capabilityDomain}:${lawId}`);
};

export const buildGeneratedDrift = (laws: LawRecord[], manifests: OwnerManifest[]): string[] => [
  ...activeLawCensusDrift(laws),
  ...ownerMatrixDrift(manifests),
];
