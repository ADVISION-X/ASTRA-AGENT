import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { SHOW_RUNTIME_PROOF_TIMELINE_CONTRACT, type ShowRuntimeProofTimelineInput, type ShowRuntimeProofTimelineOutput } from "./contract.js";
import { ShowRuntimeProofTimelineInputSchema, ShowRuntimeProofTimelineOutputSchema } from "./schema.js";

export const SHOW_RUNTIME_PROOF_TIMELINE_CHILD: CommanderConsoleChildDefinition<ShowRuntimeProofTimelineInput, ShowRuntimeProofTimelineOutput> = {
  ...SHOW_RUNTIME_PROOF_TIMELINE_CONTRACT,
  inputSchema: ShowRuntimeProofTimelineInputSchema,
  outputSchema: ShowRuntimeProofTimelineOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_RUNTIME_PROOF_TIMELINE_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowRuntimeProofTimelineInputSchema,
      context,
      read: async (readInput) => context.runtimeProofReadModel.listRuntimeProofEntries(readInput.limit),
      buildEvidenceRefs: () => [],
    });
  },
};