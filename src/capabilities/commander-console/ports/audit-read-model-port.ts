import type { CommanderAuditSummary } from "../shared/view-model-types.js";

export interface AuditReadModelPort {
  readAuditSummary(): Promise<CommanderAuditSummary>;
}