import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import {
  type AtomicMuscleMemoryEntry,
  MuscleMemoryCatalogSchema,
} from "./muscle-memory-catalog.schema.js";
import {
  MUSCLE_MEMORY_ATOMIC_SEEDS,
  MUSCLE_MEMORY_CATALOG_VERSION,
  MUSCLE_MEMORY_COMPOSITE_SEEDS,
  type AtomicSeed,
} from "./catalog-seed.js";

type CapabilityCatalogEntry = {
  abilityGroupId: string;
  childCapabilityId: string;
  description: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
  requiresGeometryProof: boolean;
  requiresPostActionVerification: boolean;
  sensitiveOperation: boolean;
  forbiddenResponsibilities: string[];
};

const CAPABILITY_CATALOG_PATH = new URL("../../map-plugins/authoring/capability-catalog/capability-catalog.generated.json", import.meta.url);
const GENERATED_OUTPUT_PATH = new URL("./muscle-memory-catalog.generated.json", import.meta.url);

function readCapabilityCatalog(): Map<string, CapabilityCatalogEntry> {
  const parsed = JSON.parse(readFileSync(CAPABILITY_CATALOG_PATH, "utf8")) as { entries: CapabilityCatalogEntry[] };
  return new Map(parsed.entries.map((entry) => [`${entry.abilityGroupId}:${entry.childCapabilityId}`, entry]));
}

function buildAtomicEntry(seed: AtomicSeed, catalog: Map<string, CapabilityCatalogEntry>): AtomicMuscleMemoryEntry {
  const capability = catalog.get(`${seed.abilityGroupId}:${seed.childCapabilityId}`);
  if (!capability) {
    throw new Error(`Missing capability catalog entry for ${seed.actionCode} -> ${seed.abilityGroupId}:${seed.childCapabilityId}.`);
  }

  return {
    actionCode: seed.actionCode,
    type: "atomic",
    displayName: seed.displayName,
    description: seed.description || capability.description,
    abilityGroupId: seed.abilityGroupId,
    childCapabilityId: seed.childCapabilityId,
    inputSchemaRef: capability.inputSchemaRef,
    outputSchemaRef: capability.outputSchemaRef,
    allowedForAiActionPlan: seed.allowedForAiActionPlan,
    allowedForUserRequirement: seed.allowedForUserRequirement,
    requiresGridSpecRef: seed.requiresGridSpecRef,
    requiresScreenshotRef: seed.requiresScreenshotRef,
    requiresPageStateRef: seed.requiresPageStateRef,
    requiresGeometryProof: seed.requiresGeometryProof || capability.requiresGeometryProof,
    requiresPostActionVerification: seed.requiresPostActionVerification || capability.requiresPostActionVerification,
    sensitiveOperation: seed.sensitiveOperation || capability.sensitiveOperation,
    inputContract: seed.inputContract,
    successOutputRefs: seed.successOutputRefs,
    failurePolicy: seed.failurePolicy,
    forbiddenResponsibilities: capability.forbiddenResponsibilities,
  };
}

function buildCatalog() {
  const capabilityCatalog = readCapabilityCatalog();
  const entries = [
    ...MUSCLE_MEMORY_ATOMIC_SEEDS.map((seed) => buildAtomicEntry(seed, capabilityCatalog)),
    ...MUSCLE_MEMORY_COMPOSITE_SEEDS,
  ].sort((left, right) => left.actionCode.localeCompare(right.actionCode));

  const uniqueActionCodes = new Set(entries.map((entry) => entry.actionCode));
  if (uniqueActionCodes.size !== entries.length) {
    throw new Error("Duplicate actionCode detected while building muscle-memory catalog.");
  }

  return MuscleMemoryCatalogSchema.parse({
    catalogId: "grasseye-muscle-memory-catalog",
    catalogVersion: MUSCLE_MEMORY_CATALOG_VERSION,
    generatedAt: new Date().toISOString(),
    entries,
  });
}

async function main() {
  const catalog = buildCatalog();
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  const checkOnly = process.argv.includes("--check");

  await mkdir(new URL(".", GENERATED_OUTPUT_PATH), { recursive: true });
  if (checkOnly) {
    const current = readFileSync(GENERATED_OUTPUT_PATH, "utf8");
    if (current !== serialized) {
      throw new Error("muscle-memory-catalog.generated.json is stale. Run build-muscle-memory-catalog.ts.");
    }
    process.stdout.write("[muscle-memory] catalog is up to date.\n");
    return;
  }

  writeFileSync(GENERATED_OUTPUT_PATH, serialized, "utf8");
  process.stdout.write(`[muscle-memory] wrote ${GENERATED_OUTPUT_PATH.pathname}.\n`);
}

await main();