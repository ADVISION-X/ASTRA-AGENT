import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { SHOW_CAPABILITY_HEALTH_CONTRACT, type ShowCapabilityHealthInput, type ShowCapabilityHealthOutput } from "./contract.js";
import { ShowCapabilityHealthInputSchema, ShowCapabilityHealthOutputSchema } from "./schema.js";

export const SHOW_CAPABILITY_HEALTH_CHILD: CommanderConsoleChildDefinition<ShowCapabilityHealthInput, ShowCapabilityHealthOutput> = {
  ...SHOW_CAPABILITY_HEALTH_CONTRACT,
  inputSchema: ShowCapabilityHealthInputSchema,
  outputSchema: ShowCapabilityHealthOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_CAPABILITY_HEALTH_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowCapabilityHealthInputSchema,
      context,
      read: async () => context.capabilityHealthReadModel.listHealthSummaries(),
      buildEvidenceRefs: () => [],
    });
  },
};