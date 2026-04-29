import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowRuntimeProofTimelineInput, ShowRuntimeProofTimelineOutput } from "./contract.js";
import { ShowRuntimeProofTimelineInputSchema, ShowRuntimeProofTimelineOutputSchema } from "./schema.js";

export const SHOW_RUNTIME_PROOF_TIMELINE_CHILD: CommanderConsoleChildDefinition<ShowRuntimeProofTimelineInput, ShowRuntimeProofTimelineOutput> = {
  childCapabilityId: "show-runtime-proof-timeline",
  inputSchema: ShowRuntimeProofTimelineInputSchema,
  outputSchema: ShowRuntimeProofTimelineOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-runtime-proof-timeline", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-runtime-proof-timeline", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.runtimeProofReadModel.listRuntimeProofEntries(input.input.limit);
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `runtime-proof:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};