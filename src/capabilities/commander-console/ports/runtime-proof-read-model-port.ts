import type { CommanderRuntimeProofEntry } from "../shared/view-model-types.js";

export interface RuntimeProofReadModelPort {
  listRuntimeProofEntries(limit?: number): Promise<CommanderRuntimeProofEntry[]>;
}