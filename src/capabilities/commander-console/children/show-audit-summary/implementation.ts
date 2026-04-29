import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { SHOW_AUDIT_SUMMARY_CONTRACT, type ShowAuditSummaryInput, type ShowAuditSummaryOutput } from "./contract.js";
import { ShowAuditSummaryInputSchema, ShowAuditSummaryOutputSchema } from "./schema.js";

export const SHOW_AUDIT_SUMMARY_CHILD: CommanderConsoleChildDefinition<ShowAuditSummaryInput, ShowAuditSummaryOutput> = {
  ...SHOW_AUDIT_SUMMARY_CONTRACT,
  inputSchema: ShowAuditSummaryInputSchema,
  outputSchema: ShowAuditSummaryOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_AUDIT_SUMMARY_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowAuditSummaryInputSchema,
      context,
      read: async () => context.auditReadModel.readAuditSummary(),
      buildEvidenceRefs: () => [],
    });
  },
};