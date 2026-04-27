import { createPhase } from "../../core/result.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Local Data Owner Inspector",
  inspectorId: "local-data-owner",
  capabilityDomain: "local-data",
  inspectorEntry: "scripts/audit/domains/local-data/inspector.ts",
  ownedPaths: ["src/features/local-data", "src/lib/storage"],
  pendingSummary: "local-data implementation pending; manual-first law only; no code-level enforcement yet",
  implementedSummary: "local data is implemented through a local JSON state store with delete and export surfaces",
  extraChecks: async () => {
    const evidenceSource = await readTextFile(pathFromRepoRoot("src/features/local-data/evidence-store-service.ts"));
    const storeSource = await readTextFile(pathFromRepoRoot("src/lib/storage/json-state-store.ts"));
    const workbenchSource = await readTextFile(pathFromRepoRoot("src/lib/local-runtime/workbench.ts"));
    const serverSource = await readTextFile(pathFromRepoRoot("src/app/server.ts"));
    const localDataPassed =
      evidenceSource.includes("deleteCandidate") &&
      evidenceSource.includes("exportCandidateSummaries") &&
      evidenceSource.includes("resetLocalStore") &&
      evidenceSource.includes("artifactsDir") &&
      workbenchSource.includes("resetLocalStore") &&
      serverSource.includes('url.pathname === "/api/runtime/reset-store"') &&
      storeSource.includes("path.dirname") &&
      storeSource.includes("JSON.stringify(state, null, 2)");

    return {
      phases: [
        createPhase(
          "local-store-boundary",
          localDataPassed ? "PASS" : "LAW-SCRIPT DRIFT",
          localDataPassed,
          localDataPassed
            ? "Local data store keeps local persistence, artifact storage, delete/export, and reset boundaries in code."
            : "Local data store is missing a required local persistence, reset, or delete/export boundary.",
        ),
      ],
    };
  },
});