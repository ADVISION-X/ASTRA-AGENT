import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { RESUME_MISSION_CONTRACT, type ResumeMissionInput, type ResumeMissionOutput } from "./contract.js";
import { ResumeMissionInputSchema, ResumeMissionOutputSchema } from "./schema.js";

export const RESUME_MISSION_CHILD: CommanderConsoleChildDefinition<ResumeMissionInput, ResumeMissionOutput> = {
  ...RESUME_MISSION_CONTRACT,
  inputSchema: ResumeMissionInputSchema,
  outputSchema: ResumeMissionOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: RESUME_MISSION_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "resume-mission",
        targetMissionId: commandInput.targetMissionId ?? null,
        selectedMapId: null,
        targetRecordRef: null,
        requestedPlatformId: null,
        humanGoal: null,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : ResumeMissionOutputSchema.parse(outcome.output),
    };
  },
};