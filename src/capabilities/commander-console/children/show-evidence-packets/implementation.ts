import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowEvidencePacketsInput, ShowEvidencePacketsOutput } from "./contract.js";
import { ShowEvidencePacketsInputSchema, ShowEvidencePacketsOutputSchema } from "./schema.js";

export const SHOW_EVIDENCE_PACKETS_CHILD: CommanderConsoleChildDefinition<ShowEvidencePacketsInput, ShowEvidencePacketsOutput> = {
  childCapabilityId: "show-evidence-packets",
  inputSchema: ShowEvidencePacketsInputSchema,
  outputSchema: ShowEvidencePacketsOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-evidence-packets", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-evidence-packets", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.forensicsReadModel.listEvidencePackets(input.input.limit);
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `evidence-packets:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};