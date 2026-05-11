import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { EMERGENCY_STOP_CONTRACT, type EmergencyStopInput, type EmergencyStopOutput } from "./contract.js";
import { EmergencyStopInputSchema, EmergencyStopOutputSchema } from "./schema.js";

export const EMERGENCY_STOP_CHILD: CommanderConsoleChildDefinition<EmergencyStopInput, EmergencyStopOutput> = {
  ...EMERGENCY_STOP_CONTRACT,
  inputSchema: EmergencyStopInputSchema,
  outputSchema: EmergencyStopOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: EMERGENCY_STOP_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "emergency-stop",
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
      output: outcome.output === null ? null : EmergencyStopOutputSchema.parse(outcome.output),
    };
  },
};