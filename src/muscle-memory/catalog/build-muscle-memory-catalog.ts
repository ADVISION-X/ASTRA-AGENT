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

const GENERATED_OUTPUT_PATH = new URL("./muscle-memory-catalog.generated.json", import.meta.url);

type CapabilityMetadata = {
  requiresGeometryProof: boolean;
  requiresPostActionVerification: boolean;
  sensitiveOperation: boolean;
  forbiddenResponsibilities: string[];
};

const CAPABILITY_METADATA_BY_ABILITY_GROUP: Record<string, CapabilityMetadata> = {
  screenshot: {
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: [
      "execute actions",
      "author prompt contracts",
      "persist evidence records directly",
    ],
  },
  ai: {
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: [
      "execute browser actions",
      "invent prompt text",
      "read credentials or cookies",
    ],
  },
  "geometry-guard": {
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    sensitiveOperation: false,
    forbiddenResponsibilities: [
      "execute browser primitives directly",
      "decide business meaning",
      "invent source geometry",
    ],
  },
  "forensics-persistence": {
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: [
      "execute browser actions",
      "classify page state",
      "author prompts",
    ],
  },
  "text-input": {
    requiresGeometryProof: false,
    requiresPostActionVerification: true,
    sensitiveOperation: true,
    forbiddenResponsibilities: [
      "invent credentials",
      "click targets",
      "decide map branching",
    ],
  },
  "mouse-click": {
    requiresGeometryProof: true,
    requiresPostActionVerification: true,
    sensitiveOperation: true,
    forbiddenResponsibilities: [
      "invent geometry",
      "skip post-click observation",
      "read page state",
    ],
  },
  open: {
    requiresGeometryProof: false,
    requiresPostActionVerification: true,
    sensitiveOperation: false,
    forbiddenResponsibilities: [
      "click page elements",
      "skip page-state handoff",
      "reuse ungoverned URLs",
    ],
  },
  orchestration: {
    requiresGeometryProof: false,
    requiresPostActionVerification: false,
    sensitiveOperation: true,
    forbiddenResponsibilities: [
      "execute browser primitives directly",
      "invent user goals",
      "bypass human review",
    ],
  },
};

function buildSchemaRef(seed: AtomicSeed, kind: "input" | "output"): string {
  return `${seed.abilityGroupId}.${seed.childCapabilityId}.${kind}`;
}

function resolveCapabilityMetadata(seed: AtomicSeed): CapabilityMetadata {
  const metadata = CAPABILITY_METADATA_BY_ABILITY_GROUP[seed.abilityGroupId];
  if (!metadata) {
    throw new Error(`Missing capability metadata for ${seed.actionCode} -> ${seed.abilityGroupId}:${seed.childCapabilityId}.`);
  }

  return metadata;
}

function buildAtomicEntry(seed: AtomicSeed): AtomicMuscleMemoryEntry {
  const metadata = resolveCapabilityMetadata(seed);

  return {
    actionCode: seed.actionCode,
    type: "atomic",
    displayName: seed.displayName,
    description: seed.description,
    abilityGroupId: seed.abilityGroupId,
    childCapabilityId: seed.childCapabilityId,
    inputSchemaRef: buildSchemaRef(seed, "input"),
    outputSchemaRef: buildSchemaRef(seed, "output"),
    allowedForAiActionPlan: seed.allowedForAiActionPlan,
    allowedForUserRequirement: seed.allowedForUserRequirement,
    requiresGridSpecRef: seed.requiresGridSpecRef,
    requiresScreenshotRef: seed.requiresScreenshotRef,
    requiresPageStateRef: seed.requiresPageStateRef,
    requiresGeometryProof: seed.requiresGeometryProof || metadata.requiresGeometryProof,
    requiresPostActionVerification: seed.requiresPostActionVerification || metadata.requiresPostActionVerification,
    sensitiveOperation: seed.sensitiveOperation || metadata.sensitiveOperation,
    inputContract: seed.inputContract,
    successOutputRefs: seed.successOutputRefs,
    failurePolicy: seed.failurePolicy,
    forbiddenResponsibilities: metadata.forbiddenResponsibilities,
  };
}

function buildCatalog() {
  const entries = [
    ...MUSCLE_MEMORY_ATOMIC_SEEDS.map((seed) => buildAtomicEntry(seed)),
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