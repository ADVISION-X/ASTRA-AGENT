import type { CommanderAuditSummary } from "../shared/commander-view-types.js";

export interface AuditReadModelPort {
  readAuditSummary(): Promise<CommanderAuditSummary>;
}