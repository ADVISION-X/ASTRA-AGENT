import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowCapabilityHealthInput, ShowCapabilityHealthOutput } from "./contract.js";
import { ShowCapabilityHealthInputSchema, ShowCapabilityHealthOutputSchema } from "./schema.js";

export const SHOW_CAPABILITY_HEALTH_CHILD: CommanderConsoleChildDefinition<ShowCapabilityHealthInput, ShowCapabilityHealthOutput> = {
  childCapabilityId: "show-capability-health",
  inputSchema: ShowCapabilityHealthInputSchema,
  outputSchema: ShowCapabilityHealthOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-capability-health", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-capability-health", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.capabilityHealthReadModel.listHealthSummaries();
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `capability-health:${output.length}`, evidenceRefs: output.map((entry) => entry.id), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};