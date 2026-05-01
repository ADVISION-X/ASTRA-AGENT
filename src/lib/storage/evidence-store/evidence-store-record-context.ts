import type { JsonStateStore } from "../../../lib/storage/json-state-store.js";

import type { EvidenceStoreStructuredLogBus as StructuredLogBus } from "./evidence-store-runtime-types.js";
import type { PersistedState } from "./evidence-store-state.js";

type EvidenceStoreRecordsContext = {
  artifactsDir: string;
  stateStore: JsonStateStore<PersistedState>;
  structuredLogBus?: StructuredLogBus;
  init: () => Promise<void>;
  listState: () => Promise<PersistedState>;
};

function replaceOrAppend<TItem>(
  items: TItem[],
  nextItem: TItem,
  matches: (item: TItem) => boolean,
): void {
  const existingIndex = items.findIndex(matches);
  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
    return;
  }
  items.push(nextItem);
}

export {
  replaceOrAppend,
};

export type {
  EvidenceStoreRecordsContext,
};