import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { REJECT_CANDIDATE_CONTRACT, type RejectCandidateInput, type RejectCandidateOutput } from "./contract.js";
import { RejectCandidateInputSchema, RejectCandidateOutputSchema } from "./schema.js";

export const REJECT_CANDIDATE_CHILD: CommanderConsoleChildDefinition<RejectCandidateInput, RejectCandidateOutput> = {
  ...REJECT_CANDIDATE_CONTRACT,
  inputSchema: RejectCandidateInputSchema,
  outputSchema: RejectCandidateOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: REJECT_CANDIDATE_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "reject-candidate",
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
      output: outcome.output === null ? null : RejectCandidateOutputSchema.parse(outcome.output),
    };
  },
};