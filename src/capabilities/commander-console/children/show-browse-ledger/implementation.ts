import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_BROWSE_LEDGER_CONTRACT, type ShowBrowseLedgerInput, type ShowBrowseLedgerOutput } from "./contract.js";
import { ShowBrowseLedgerInputSchema, ShowBrowseLedgerOutputSchema } from "./schema.js";

export const SHOW_BROWSE_LEDGER_CHILD: CommanderConsoleChildDefinition<ShowBrowseLedgerInput, ShowBrowseLedgerOutput> = {
  ...SHOW_BROWSE_LEDGER_CONTRACT,
  inputSchema: ShowBrowseLedgerInputSchema,
  outputSchema: ShowBrowseLedgerOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_BROWSE_LEDGER_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowBrowseLedgerInputSchema,
      context,
      read: async (readInput) => context.forensicsReadModel.listBrowseLedger(readInput.limit),
      buildEvidenceRefs: (records) => records.length > 0
        ? records.map((record) => buildCommanderEvidenceRef({
          recordType: "browse-ledger",
          recordId: record.id,
          sourceAbility: "forensics-read-model",
        }))
        : [buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: "browse-ledger:empty",
          sourceAbility: "forensics-read-model",
        })],
    });
  },
};