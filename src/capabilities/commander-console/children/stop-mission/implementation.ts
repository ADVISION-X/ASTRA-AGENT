import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { STOP_MISSION_CONTRACT, type StopMissionInput, type StopMissionOutput } from "./contract.js";
import { StopMissionInputSchema, StopMissionOutputSchema } from "./schema.js";

export const STOP_MISSION_CHILD: CommanderConsoleChildDefinition<StopMissionInput, StopMissionOutput> = {
  ...STOP_MISSION_CONTRACT,
  inputSchema: StopMissionInputSchema,
  outputSchema: StopMissionOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: STOP_MISSION_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "stop-mission",
        targetMissionId: commandInput.targetMissionId ?? null,
        selectedBindingId: null,
        targetRecordRef: null,
        requestedPlatformId: null,
        humanGoal: null,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : StopMissionOutputSchema.parse(outcome.output),
    };
  },
};