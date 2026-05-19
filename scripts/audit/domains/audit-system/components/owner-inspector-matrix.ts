import { writeGeneratedJson } from "../../../core/generated-artifact.js";
import { manifestPathForDomain } from "../../../core/owner-manifests.js";
import type { LawRecord, OwnerManifest, OwnerMatrixDomain } from "../../../core/schema.js";

export type OwnerInspectorMatrixResult = {
  domains: OwnerMatrixDomain[];
};

export const buildOwnerInspectorMatrix = (
  laws: LawRecord[],
  manifests: OwnerManifest[],
): OwnerInspectorMatrixResult => {
  const lawsByDomain = new Map<string, string[]>();
  for (const law of laws) {
    const current = lawsByDomain.get(law.capabilityDomain) ?? [];
    current.push(law.lawId);
    lawsByDomain.set(law.capabilityDomain, current);
  }

  const manifestByDomain = new Map(manifests.map((manifest) => [manifest.capabilityDomain, manifest]));
  const domains = [...lawsByDomain.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([capabilityDomain, lawIds]) => {
      const manifest = manifestByDomain.get(capabilityDomain);
      return {
        capabilityDomain,
        lawIds,
        manifestPath: manifest ? `scripts/audit/domains/${capabilityDomain}/manifest.json` : manifestPathForDomain(capabilityDomain),
        inspectorId: manifest?.inspectorId ?? "missing-inspector",
        inspectorEntry: manifest?.entry ?? "missing-entry",
        runner: manifest?.runner ?? "missing-runner",
        status: manifest ? "covered" : "missing",
      } satisfies OwnerMatrixDomain;
    });

  writeGeneratedJson("owner-inspector-matrix.generated.json", {
    generatedAt: new Date().toISOString(),
    domains,
    violations: domains.filter((domain) => domain.status !== "covered"),
  });

  return { domains };
};