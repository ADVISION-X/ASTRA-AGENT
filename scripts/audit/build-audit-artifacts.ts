import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { composeArtifacts } from "./build/compose-artifacts.js";
import { discoverLawFiles } from "./build/discover-law-files.js";
import { loadManifests } from "./build/load-manifests.js";
import { parseApexLaws } from "./build/parse-apex-laws.js";
import { writeGeneratedArtifacts } from "./build/write-generated-artifacts.js";

export const buildAuditArtifacts = (): void => {
  const { laws, conflicts: lawConflicts } = parseApexLaws(discoverLawFiles());
  const { manifests, conflicts: manifestConflicts } = loadManifests();
  const artifacts = composeArtifacts(laws, manifests);
  const conflicts = [...lawConflicts, ...manifestConflicts, ...artifacts.conflicts];

  writeGeneratedArtifacts({
    laws,
    matrixRows: artifacts.matrixRows,
    planEntries: artifacts.planEntries,
    conflicts,
    staticCoverage: artifacts.staticCoverage,
  });

  if (conflicts.length > 0) {
    throw new Error(`Audit artifact generation failed with ${conflicts.length} conflict(s).`);
  }
  process.stdout.write("[AUDIT-BUILD] PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  buildAuditArtifacts();
}