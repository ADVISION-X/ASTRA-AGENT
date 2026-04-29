import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowBrowseLedgerInput, ShowBrowseLedgerOutput } from "./contract.js";
import { ShowBrowseLedgerInputSchema, ShowBrowseLedgerOutputSchema } from "./schema.js";

export const SHOW_BROWSE_LEDGER_CHILD: CommanderConsoleChildDefinition<ShowBrowseLedgerInput, ShowBrowseLedgerOutput> = {
  childCapabilityId: "show-browse-ledger",
  inputSchema: ShowBrowseLedgerInputSchema,
  outputSchema: ShowBrowseLedgerOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-browse-ledger", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-browse-ledger", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.forensicsReadModel.listBrowseLedger(input.input.limit);
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `browse-ledger:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};