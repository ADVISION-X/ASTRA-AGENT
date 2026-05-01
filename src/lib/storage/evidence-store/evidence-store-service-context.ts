import { mkdir } from "node:fs/promises";
import path from "node:path";

import { JsonStateStore } from "../../../lib/storage/json-state-store.js";

import type { EvidenceStoreStructuredLogBus as StructuredLogBus } from "./evidence-store-runtime-types.js";
import { PersistedStateSchema, createInitialState, normalizePersistedState, type PersistedState } from "./evidence-store-state.js";
import type { EvidenceStoreRecordsContext } from "./evidence-store-record-context.js";

type EvidenceStoreInternals = {
  artifactsDir: string;
  dataDir: string;
  init: () => Promise<void>;
  listState: () => Promise<PersistedState>;
  stateStore: JsonStateStore<PersistedState>;
  structuredLogBus?: StructuredLogBus;
};

function createEvidenceStoreInternals(dataDir: string, structuredLogBus?: StructuredLogBus): EvidenceStoreInternals {
  const artifactsDir = path.join(dataDir, "artifacts");
  const stateStore = new JsonStateStore(path.join(dataDir, "state.json"), createInitialState);

  const init = async (): Promise<void> => {
    await mkdir(artifactsDir, { recursive: true });
    await stateStore.init();
  };

  const listState = async (): Promise<PersistedState> => {
    const rawState = await stateStore.read();
    const normalizedState = normalizePersistedState(rawState);
    const parsedState = PersistedStateSchema.parse(normalizedState.normalized);
    if (normalizedState.migrated) {
      await stateStore.write(parsedState);
    }
    return parsedState;
  };

  return {
    artifactsDir,
    dataDir,
    init,
    listState,
    stateStore,
    ...(structuredLogBus ? { structuredLogBus } : {}),
  };
}

function createEvidenceStoreRecordsContext(
  internals: EvidenceStoreInternals,
): EvidenceStoreRecordsContext {
  return {
    artifactsDir: internals.artifactsDir,
    stateStore: internals.stateStore,
    ...(internals.structuredLogBus ? { structuredLogBus: internals.structuredLogBus } : {}),
    init: internals.init,
    listState: internals.listState,
  };
}

function createEvidenceStoreMaintenanceContext(internals: EvidenceStoreInternals) {
  return {
    artifactsDir: internals.artifactsDir,
    dataDir: internals.dataDir,
    stateStore: internals.stateStore,
    init: internals.init,
    listState: internals.listState,
  };
}

export {
  createEvidenceStoreInternals,
  createEvidenceStoreMaintenanceContext,
  createEvidenceStoreRecordsContext,
};

export type {
  EvidenceStoreInternals,
};