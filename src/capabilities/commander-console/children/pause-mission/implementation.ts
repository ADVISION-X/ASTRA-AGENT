import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { PAUSE_MISSION_CONTRACT, type PauseMissionInput, type PauseMissionOutput } from "./contract.js";
import { PauseMissionInputSchema, PauseMissionOutputSchema } from "./schema.js";

export const PAUSE_MISSION_CHILD: CommanderConsoleChildDefinition<PauseMissionInput, PauseMissionOutput> = {
  ...PAUSE_MISSION_CONTRACT,
  inputSchema: PauseMissionInputSchema,
  outputSchema: PauseMissionOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: PAUSE_MISSION_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "pause-mission",
        targetMissionId: commandInput.targetMissionId ?? null,
        targetBindingId: null,
        targetRecordRef: null,
        requestedPlatformId: null,
        humanGoal: null,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : PauseMissionOutputSchema.parse(outcome.output),
    };
  },
};