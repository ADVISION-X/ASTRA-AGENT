import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_EVIDENCE_PACKETS_CONTRACT, type ShowEvidencePacketsInput, type ShowEvidencePacketsOutput } from "./contract.js";
import { ShowEvidencePacketsInputSchema, ShowEvidencePacketsOutputSchema } from "./schema.js";

export const SHOW_EVIDENCE_PACKETS_CHILD: CommanderConsoleChildDefinition<ShowEvidencePacketsInput, ShowEvidencePacketsOutput> = {
  ...SHOW_EVIDENCE_PACKETS_CONTRACT,
  inputSchema: ShowEvidencePacketsInputSchema,
  outputSchema: ShowEvidencePacketsOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_EVIDENCE_PACKETS_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowEvidencePacketsInputSchema,
      context,
      read: async (readInput) => context.forensicsReadModel.listEvidencePackets(readInput.limit),
      buildEvidenceRefs: (records) => records.map((record) => buildCommanderEvidenceRef({
        recordType: "evidence-packet",
        recordId: record.id,
        sourceAbility: "forensics-read-model",
      })),
    });
  },
};