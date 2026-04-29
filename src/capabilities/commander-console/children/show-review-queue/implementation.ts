import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowReviewQueueInput, ShowReviewQueueOutput } from "./contract.js";
import { ShowReviewQueueInputSchema, ShowReviewQueueOutputSchema } from "./schema.js";

export const SHOW_REVIEW_QUEUE_CHILD: CommanderConsoleChildDefinition<ShowReviewQueueInput, ShowReviewQueueOutput> = {
  childCapabilityId: "show-review-queue",
  inputSchema: ShowReviewQueueInputSchema,
  outputSchema: ShowReviewQueueOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-review-queue", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-review-queue", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.forensicsReadModel.listReviewQueue();
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `review-queue:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};