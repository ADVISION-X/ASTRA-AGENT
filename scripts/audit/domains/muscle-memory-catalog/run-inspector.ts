import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import {
  checkFileCount,
  checkNoForbiddenSubdirs,
  checkSchemaAtomicOnly,
  checkCatalogNoComposite,
  checkNoForbiddenActionCodes,
  checkNoForbiddenSchemaFieldsInEntries,
  checkAiVisibleEntriesHaveGroupIds,
  checkRequiredFilesExist,
} from "./inspector.js";

const MUSCLE_MEMORY_ROOT = "src/muscle-memory";

/**
 * MuscleMemory Catalog Registry Inspector
 *
 * Answers 8 governance questions:
 *   1. src/muscle-memory file count ≤ 5?
 *   2. No executor/decoder/system-manual/catalog subdirectories?
 *   3. Catalog schema allows only atomic entries (no forbidden fields)?
 *   4. No composite/recipe keywords in generated-catalog.json?
 *   5. No forbidden legacy action codes (CLICK_CELL, CLICK_BROWSER_COORDINATE, etc.)?
 *   6. No forbidden schema fields in any catalog entry?
 *   7. Each AI-visible entry has abilityGroupId + childCapabilityId?
 *   8. All required core files exist (schema.ts, catalog.ts, manual.ts, generated-catalog.json)?
 */
export const muscleMemoryCatalogInspector = createPendingDomainInspector({
  inspector: "GrassEye MuscleMemory Catalog Registry Inspector",
  inspectorId: "muscle-memory-catalog-owner",
  capabilityDomain: "muscle-memory-catalog",
  inspectorEntry: "scripts/audit/domains/muscle-memory-catalog/run-inspector.ts",
  ownedPaths: [MUSCLE_MEMORY_ROOT],
  pendingSummary:
    "muscle-memory-catalog registry law active; atomic-only registry with ≤5 files pending verification",
  implementedSummary:
    "muscle-memory is a pure atomic capability registry with ≤5 files, no executor/decoder, and clean catalog",
  extraChecks: async () => {
    const [
      requiredFiles,
      fileCount,
      noForbiddenSubdirs,
      schemaAtomicOnly,
      catalogNoComposite,
      noForbiddenCodes,
      noForbiddenFields,
      aiVisibleGroupIds,
    ] = await Promise.all([
      checkRequiredFilesExist(),
      checkFileCount(),
      checkNoForbiddenSubdirs(),
      checkSchemaAtomicOnly(),
      checkCatalogNoComposite(),
      checkNoForbiddenActionCodes(),
      checkNoForbiddenSchemaFieldsInEntries(),
      checkAiVisibleEntriesHaveGroupIds(),
    ]);

    return {
      findings: [
        ...requiredFiles.findings,
        ...fileCount.findings,
        ...noForbiddenSubdirs.findings,
        ...schemaAtomicOnly.findings,
        ...catalogNoComposite.findings,
        ...noForbiddenCodes.findings,
        ...noForbiddenFields.findings,
        ...aiVisibleGroupIds.findings,
      ],
      phases: [
        requiredFiles.phase,
        fileCount.phase,
        noForbiddenSubdirs.phase,
        schemaAtomicOnly.phase,
        catalogNoComposite.phase,
        noForbiddenCodes.phase,
        noForbiddenFields.phase,
        aiVisibleGroupIds.phase,
      ],
    };
  },
});
