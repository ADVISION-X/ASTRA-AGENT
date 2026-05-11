import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { ISSUE_HUMAN_COMMAND_CONTRACT, type IssueHumanCommandInput, type IssueHumanCommandOutput } from "./contract.js";
import { IssueHumanCommandInputSchema, IssueHumanCommandOutputSchema } from "./schema.js";

export const ISSUE_HUMAN_COMMAND_CHILD: CommanderConsoleChildDefinition<IssueHumanCommandInput, IssueHumanCommandOutput> = {
  ...ISSUE_HUMAN_COMMAND_CONTRACT,
  inputSchema: IssueHumanCommandInputSchema,
  outputSchema: IssueHumanCommandOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: ISSUE_HUMAN_COMMAND_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "start-mission",
        targetMissionId: null,
        selectedBindingId: null,
        targetRecordRef: null,
        requestedPlatformId: commandInput.requestedPlatformId ?? null,
        humanGoal: commandInput.humanGoal ?? null,
        maxRounds: commandInput.maxRounds,
        maxMinutes: commandInput.maxMinutes,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: commandInput.initialPayload ?? null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : IssueHumanCommandOutputSchema.parse(outcome.output),
    };
  },
};