import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_OPERATIONAL_MAP_PROGRESS_CONTRACT, type ShowOperationalMapProgressInput, type ShowOperationalMapProgressOutput } from "./contract.js";
import { ShowOperationalMapProgressInputSchema, ShowOperationalMapProgressOutputSchema } from "./schema.js";

export const SHOW_OPERATIONAL_MAP_PROGRESS_CHILD: CommanderConsoleChildDefinition<ShowOperationalMapProgressInput, ShowOperationalMapProgressOutput> = {
  ...SHOW_OPERATIONAL_MAP_PROGRESS_CONTRACT,
  inputSchema: ShowOperationalMapProgressInputSchema,
  outputSchema: ShowOperationalMapProgressOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_OPERATIONAL_MAP_PROGRESS_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowOperationalMapProgressInputSchema,
      context,
      read: async () => context.missionReadModel.readMission(),
      buildEvidenceRefs: (mission) => mission.missionId
        ? [buildCommanderEvidenceRef({ recordType: "mission", recordId: mission.missionId, sourceAbility: "mission-read-model" })]
        : [buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: "operational-map-progress:empty",
          sourceAbility: "mission-read-model",
        })],
      buildOutputPolicy: (mission) => ({ missionId: mission.missionId }),
    });
  },
};