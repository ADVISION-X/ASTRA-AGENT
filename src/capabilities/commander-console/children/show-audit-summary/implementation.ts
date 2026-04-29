import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowAuditSummaryInput, ShowAuditSummaryOutput } from "./contract.js";
import { ShowAuditSummaryInputSchema, ShowAuditSummaryOutputSchema } from "./schema.js";

export const SHOW_AUDIT_SUMMARY_CHILD: CommanderConsoleChildDefinition<ShowAuditSummaryInput, ShowAuditSummaryOutput> = {
  childCapabilityId: "show-audit-summary",
  inputSchema: ShowAuditSummaryInputSchema,
  outputSchema: ShowAuditSummaryOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-audit-summary", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-audit-summary", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.auditReadModel.readAuditSummary();
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `audit-summary:${output.lastGeneratedAt ?? "none"}`, evidenceRefs: [], dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};