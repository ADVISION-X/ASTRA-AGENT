import type { CommanderRuntimeProofTimelineEntry } from "../shared/commander-view-types.js";

export interface RuntimeProofReadModelPort {
  listRuntimeProofEntries(limit?: number): Promise<CommanderRuntimeProofTimelineEntry[]>;
}