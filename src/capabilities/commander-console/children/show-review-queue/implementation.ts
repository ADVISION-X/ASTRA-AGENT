import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { executeCommanderReadChild } from "../../runtime/commander-child-executors.js";
import { buildCommanderEvidenceRef } from "../../runtime/commander-boundary-policy.js";
import { SHOW_REVIEW_QUEUE_CONTRACT, type ShowReviewQueueInput, type ShowReviewQueueOutput } from "./contract.js";
import { ShowReviewQueueInputSchema, ShowReviewQueueOutputSchema } from "./schema.js";

export const SHOW_REVIEW_QUEUE_CHILD: CommanderConsoleChildDefinition<ShowReviewQueueInput, ShowReviewQueueOutput> = {
  ...SHOW_REVIEW_QUEUE_CONTRACT,
  inputSchema: ShowReviewQueueInputSchema,
  outputSchema: ShowReviewQueueOutputSchema,
  async execute(input, context) {
    return executeCommanderReadChild({
      contract: SHOW_REVIEW_QUEUE_CONTRACT,
      operatorRef: input.operatorRef,
      rawInput: input.input,
      inputSchema: ShowReviewQueueInputSchema,
      context,
      read: async () => context.forensicsReadModel.listReviewQueue(),
      buildEvidenceRefs: (records) => records.length > 0
        ? records.map((record) => buildCommanderEvidenceRef({
          recordType: "candidate",
          recordId: record.id,
          sourceAbility: "forensics-read-model",
        }))
        : [buildCommanderEvidenceRef({
          recordType: "runtime-event",
          recordId: "review-queue:empty",
          sourceAbility: "forensics-read-model",
        })],
    });
  },
};