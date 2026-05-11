import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderCommandChild } from "../../runtime/commander-child-executors.js";
import { MARK_REVIEW_REQUIRED_CONTRACT, type MarkReviewRequiredInput, type MarkReviewRequiredOutput } from "./contract.js";
import { MarkReviewRequiredInputSchema, MarkReviewRequiredOutputSchema } from "./schema.js";

export const MARK_REVIEW_REQUIRED_CHILD: CommanderConsoleChildDefinition<MarkReviewRequiredInput, MarkReviewRequiredOutput> = {
  ...MARK_REVIEW_REQUIRED_CONTRACT,
  inputSchema: MarkReviewRequiredInputSchema,
  outputSchema: MarkReviewRequiredOutputSchema,
  async execute(input, context) {
    const outcome = await executeCommanderCommandChild({
      contract: MARK_REVIEW_REQUIRED_CONTRACT,
      operatorRef: input.operatorRef,
      input: input.input,
      context,
      buildCommandInput: (commandInput) => ({
        commandType: "mark-review-required",
        targetMissionId: null,
        selectedBindingId: null,
        targetRecordRef: { recordType: "candidate", recordId: commandInput.candidateId },
        requestedPlatformId: null,
        humanGoal: null,
        operatorNote: commandInput.operatorNote ?? null,
        initialPayload: null,
      }),
    });
    return {
      ...outcome,
      output: outcome.output === null ? null : MarkReviewRequiredOutputSchema.parse(outcome.output),
    };
  },
};