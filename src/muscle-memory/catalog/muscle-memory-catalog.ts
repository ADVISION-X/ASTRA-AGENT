import { readFileSync } from "node:fs";

import {
  type AtomicMuscleMemoryEntry,
  type CompositeMuscleMemoryEntry,
  type MuscleMemoryCatalog,
  type MuscleMemoryEntry,
  MuscleMemoryCatalogSchema,
} from "./muscle-memory-catalog.schema.js";

const GENERATED_CATALOG_PATH = new URL("./muscle-memory-catalog.generated.json", import.meta.url);

let catalogCache: MuscleMemoryCatalog | null = null;

function readCatalog(): MuscleMemoryCatalog {
  const raw = JSON.parse(readFileSync(GENERATED_CATALOG_PATH, "utf8"));
  return MuscleMemoryCatalogSchema.parse(raw);
}

export function loadMuscleMemoryCatalog(): MuscleMemoryCatalog {
  catalogCache ??= readCatalog();
  return catalogCache;
}

export function findMuscleMemoryEntry(actionCode: string): MuscleMemoryEntry | null {
  return loadMuscleMemoryCatalog().entries.find((entry) => entry.actionCode === actionCode) ?? null;
}

export function listAiActionPlanEntries(): MuscleMemoryEntry[] {
  return loadMuscleMemoryCatalog().entries.filter((entry) => entry.allowedForAiActionPlan);
}

export function isAiActionPlanAllowedActionCode(actionCode: unknown): actionCode is string {
  return typeof actionCode === "string"
    && findMuscleMemoryEntry(actionCode)?.allowedForAiActionPlan === true;
}