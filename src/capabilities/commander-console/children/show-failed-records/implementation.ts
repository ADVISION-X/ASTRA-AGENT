import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_FAILED_RECORDS_CONTRACT, type ShowFailedRecordsInput, type ShowFailedRecordsOutput } from "./contract.js";
import { ShowFailedRecordsInputSchema, ShowFailedRecordsOutputSchema } from "./schema.js";

export const SHOW_FAILED_RECORDS_CHILD: CommanderConsoleChildDefinition<ShowFailedRecordsInput, ShowFailedRecordsOutput> = {
  ...SHOW_FAILED_RECORDS_CONTRACT,
  inputSchema: ShowFailedRecordsInputSchema,
  outputSchema: ShowFailedRecordsOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_FAILED_RECORDS_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowFailedRecordsInputSchema,
      context,
      read: async (readInput) => context.forensicsReadModel.listFailedRecords(readInput.limit),
      buildEvidenceRefs: (records) => records.map((record) => buildCommanderEvidenceRef({
        recordType: "failed-record",
        recordId: record.id,
        sourceAbility: "forensics-read-model",
      })),
    });
  },
};