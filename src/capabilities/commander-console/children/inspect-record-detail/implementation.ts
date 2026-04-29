import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { InspectRecordDetailInput, InspectRecordDetailOutput } from "./contract.js";
import { InspectRecordDetailInputSchema, InspectRecordDetailOutputSchema } from "./schema.js";

export const INSPECT_RECORD_DETAIL_CHILD: CommanderConsoleChildDefinition<InspectRecordDetailInput, InspectRecordDetailOutput> = {
  childCapabilityId: "inspect-record-detail",
  inputSchema: InspectRecordDetailInputSchema,
  outputSchema: InspectRecordDetailOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "inspect-record-detail", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "inspect-record-detail", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.forensicsReadModel.inspectRecordDetail(input.input.recordId);
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `record-detail:${output.recordId ?? input.input.recordId}`, evidenceRefs: output.recordId ? [output.recordId] : [input.input.recordId], dataQualityFlags: output.recordType === "not-found" ? ["record_not_found"] : [], boundaryDecision: "read-port-only" };
  },
};