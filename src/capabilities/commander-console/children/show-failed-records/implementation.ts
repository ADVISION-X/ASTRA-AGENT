import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowFailedRecordsInput, ShowFailedRecordsOutput } from "./contract.js";
import { ShowFailedRecordsInputSchema, ShowFailedRecordsOutputSchema } from "./schema.js";

export const SHOW_FAILED_RECORDS_CHILD: CommanderConsoleChildDefinition<ShowFailedRecordsInput, ShowFailedRecordsOutput> = {
  childCapabilityId: "show-failed-records",
  inputSchema: ShowFailedRecordsInputSchema,
  outputSchema: ShowFailedRecordsOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-failed-records", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-failed-records", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.forensicsReadModel.listFailedRecords(input.input.limit);
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `failed-records:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};