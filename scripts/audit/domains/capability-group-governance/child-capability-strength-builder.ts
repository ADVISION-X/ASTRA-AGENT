import { type Project } from "ts-morph";

import { readJsonFile, writeJsonFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { getAuditProject } from "../../core/ts-morph.js";

import { collectChildCapabilityStrengthEntries } from "./child-capability-strength-owner-scan.js";

const MUSCLE_MEMORY_CATALOG_PATH = pathFromRepoRoot("src/muscle-memory/catalog/muscle-memory-catalog.generated.json");
const INVENTORY_RELATIVE_PATH = "scripts/audit/generated/child-capability-strength-inventory.generated.json";
const INVENTORY_PATH = pathFromRepoRoot(INVENTORY_RELATIVE_PATH);

type AtomicCatalogEntry = {
  actionCode: string;
  type: "atomic";
  abilityGroupId: string;
  childCapabilityId: string;
  allowedForAiActionPlan: boolean;
  sensitiveOperation: boolean;
  requiresPostActionVerification: boolean;
};

type CompositeCatalogEntry = {
  actionCode: string;
  type: "composite";
  allowedForAiActionPlan: boolean;
  steps: Array<{ actionCode: string }>;
};

type MuscleMemoryCatalog = {
  entries: Array<AtomicCatalogEntry | CompositeCatalogEntry>;
};

type ChildCapabilityStrengthEntry = {
  abilityGroupId: string;
  childCapabilityId: string;
  declaredInContract: boolean;
  declaredInSchema: boolean;
  registered: boolean;
  hasChildContract: boolean;
  hasChildSchema: boolean;
  hasChildImplementation: boolean;
  hasExecute: boolean;
  returnsGovernedResult: boolean;
  publicExecuteThrows: boolean;
  hasNerveBusDispatchBuilder: boolean;
  hasCapabilityCatalogEntry: boolean;
  hasMuscleMemoryAction: boolean;
  allowedForAiActionPlan: boolean;
  hasForensicsRecordPath: boolean;
  strengthLevel: 0 | 1 | 2 | 3 | 4;
  actionCodes: string[];
  aiActionCodes: string[];
  blockingReasons: string[];
};

type ChildCapabilityStrengthInventory = {
  generatedAt: string;
  entries: ChildCapabilityStrengthEntry[];
};

const readCatalog = async (): Promise<MuscleMemoryCatalog> => readJsonFile<MuscleMemoryCatalog>(MUSCLE_MEMORY_CATALOG_PATH);

const getAtomicEntries = (catalog: MuscleMemoryCatalog): AtomicCatalogEntry[] =>
  catalog.entries.filter((entry): entry is AtomicCatalogEntry => entry.type === "atomic");

const addActionCode = (index: Map<string, Set<string>>, key: string, actionCode: string): void => {
  if (!index.has(key)) {
    index.set(key, new Set<string>());
  }
  index.get(key)?.add(actionCode);
};

const resolveAiReachableChildKeys = (catalog: MuscleMemoryCatalog): Map<string, Set<string>> => {
  const atomicEntries = new Map(getAtomicEntries(catalog).map((entry) => [entry.actionCode, entry]));
  const compositeEntries = new Map(catalog.entries.filter((entry): entry is CompositeCatalogEntry => entry.type === "composite").map((entry) => [entry.actionCode, entry]));
  const resolved = new Map<string, Set<string>>();

  const visit = (actionCode: string, visited: Set<string>): Set<string> => {
    if (resolved.has(actionCode)) {
      return new Set(resolved.get(actionCode));
    }
    if (visited.has(actionCode)) {
      return new Set<string>();
    }
    visited.add(actionCode);
    const atomic = atomicEntries.get(actionCode);
    if (atomic) {
      const key = `${atomic.abilityGroupId}:${atomic.childCapabilityId}`;
      const single = new Set([key]);
      resolved.set(actionCode, single);
      return single;
    }
    const composite = compositeEntries.get(actionCode);
    const next = new Set<string>();
    if (composite) {
      for (const step of composite.steps) {
        for (const key of visit(step.actionCode, visited)) {
          next.add(key);
        }
      }
    }
    resolved.set(actionCode, next);
    return new Set(next);
  };

  for (const entry of catalog.entries) {
    if (entry.allowedForAiActionPlan) {
      visit(entry.actionCode, new Set<string>());
    }
  }
  return resolved;
};

const buildActionCodeIndexes = (
  atomicEntries: AtomicCatalogEntry[],
  catalog: MuscleMemoryCatalog,
  aiReachableChildKeys: Map<string, Set<string>>,
) => {
  const actionCodesByChildKey = new Map<string, Set<string>>();
  const aiActionCodesByChildKey = new Map<string, Set<string>>();

  for (const entry of atomicEntries) {
    addActionCode(actionCodesByChildKey, `${entry.abilityGroupId}:${entry.childCapabilityId}`, entry.actionCode);
  }
  for (const entry of catalog.entries) {
    if (!entry.allowedForAiActionPlan) {
      continue;
    }
    for (const key of aiReachableChildKeys.get(entry.actionCode) ?? []) {
      addActionCode(aiActionCodesByChildKey, key, entry.actionCode);
    }
  }
  return { actionCodesByChildKey, aiActionCodesByChildKey };
};

export async function buildChildCapabilityStrengthInventory(project: Project = getAuditProject()): Promise<ChildCapabilityStrengthInventory> {
  const catalog = await readCatalog();
  const atomicEntries = getAtomicEntries(catalog);
  const aiReachableChildKeys = resolveAiReachableChildKeys(catalog);
  const { actionCodesByChildKey, aiActionCodesByChildKey } = buildActionCodeIndexes(atomicEntries, catalog, aiReachableChildKeys);
  const entries = await collectChildCapabilityStrengthEntries(project, atomicEntries, actionCodesByChildKey, aiActionCodesByChildKey);

  return {
    generatedAt: new Date().toISOString(),
    entries: entries.sort((left, right) => `${left.abilityGroupId}:${left.childCapabilityId}`.localeCompare(`${right.abilityGroupId}:${right.childCapabilityId}`)),
  };
}

export async function writeChildCapabilityStrengthInventory(project: Project = getAuditProject()): Promise<ChildCapabilityStrengthInventory> {
  const inventory = await buildChildCapabilityStrengthInventory(project);
  await writeJsonFile(INVENTORY_PATH, inventory);
  return inventory;
}

export { INVENTORY_RELATIVE_PATH };
export type { AtomicCatalogEntry, ChildCapabilityStrengthEntry, ChildCapabilityStrengthInventory, CompositeCatalogEntry, MuscleMemoryCatalog };