import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
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
      buildEvidenceRefs: (entries) => entries.length > 0
        ? entries.map((entry) => buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: entry.id,
          sourceAbility: "capability-health-read-model",
        }))
        : [buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: "capability-health:empty",
          sourceAbility: "capability-health-read-model",
        })],
    });
  },
};