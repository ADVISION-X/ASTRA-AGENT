import type {
  CommanderBrowserSummaryView,
  CommanderCapabilityHealthEntry,
  CommanderCapabilityRosterEntry,
  CommanderRuntimeSummaryView,
} from "../shared/commander-view-types.js";

export interface CapabilityHealthReadModelPort {
  readRuntimeSummary(): Promise<CommanderRuntimeSummaryView>;
  readBrowserSummary(): Promise<CommanderBrowserSummaryView>;
  listHealthSummaries(): Promise<CommanderCapabilityHealthEntry[]>;
  listCapabilityRoster(): Promise<CommanderCapabilityRosterEntry[]>;
}