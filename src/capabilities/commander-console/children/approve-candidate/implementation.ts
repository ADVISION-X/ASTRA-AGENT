import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { APPROVE_CANDIDATE_CONTRACT, type ApproveCandidateInput, type ApproveCandidateOutput } from "./contract.js";
import { ApproveCandidateInputSchema, ApproveCandidateOutputSchema } from "./schema.js";

export const APPROVE_CANDIDATE_CHILD: CommanderConsoleChildDefinition<ApproveCandidateInput, ApproveCandidateOutput> = {
  ...APPROVE_CANDIDATE_CONTRACT,
  inputSchema: ApproveCandidateInputSchema,
  outputSchema: ApproveCandidateOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: APPROVE_CANDIDATE_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "approve-candidate",
        targetMissionId: null,
        selectedMapId: null,
        targetRecordRef: { recordType: "candidate", recordId: commandInput.candidateId },
        requestedPlatformId: null,
        humanGoal: null,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : ApproveCandidateOutputSchema.parse(outcome.output),
    };
  },
};