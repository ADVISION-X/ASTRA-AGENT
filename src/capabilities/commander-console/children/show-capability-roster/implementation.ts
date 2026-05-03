import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_CAPABILITY_ROSTER_CONTRACT, type ShowCapabilityRosterInput, type ShowCapabilityRosterOutput } from "./contract.js";
import { ShowCapabilityRosterInputSchema, ShowCapabilityRosterOutputSchema } from "./schema.js";

export const SHOW_CAPABILITY_ROSTER_CHILD: CommanderConsoleChildDefinition<ShowCapabilityRosterInput, ShowCapabilityRosterOutput> = {
  ...SHOW_CAPABILITY_ROSTER_CONTRACT,
  inputSchema: ShowCapabilityRosterInputSchema,
  outputSchema: ShowCapabilityRosterOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_CAPABILITY_ROSTER_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowCapabilityRosterInputSchema,
      context,
      read: async () => context.capabilityHealthReadModel.listCapabilityRoster(),
      buildEvidenceRefs: (entries) => entries.length > 0
        ? entries.map((entry) => buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: entry.abilityGroupId,
          sourceAbility: "capability-health-read-model",
        }))
        : [buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: "capability-roster:empty",
          sourceAbility: "capability-health-read-model",
        })],
    });
  },
};