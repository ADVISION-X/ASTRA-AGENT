import type { CommanderHealthSummary } from "../shared/health-summary.js";
import type {
  CommanderBrowserSummaryView,
  CommanderCapabilityRosterEntry,
  CommanderRuntimeSummaryView,
} from "../shared/view-model-types.js";

export interface CapabilityHealthReadModelPort {
  readRuntimeSummary(): Promise<CommanderRuntimeSummaryView>;
  readBrowserSummary(): Promise<CommanderBrowserSummaryView>;
  listHealthSummaries(): Promise<CommanderHealthSummary[]>;
  listCapabilityRoster(): Promise<CommanderCapabilityRosterEntry[]>;
}