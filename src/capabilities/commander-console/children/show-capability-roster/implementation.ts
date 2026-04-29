import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowCapabilityRosterInput, ShowCapabilityRosterOutput } from "./contract.js";
import { ShowCapabilityRosterInputSchema, ShowCapabilityRosterOutputSchema } from "./schema.js";

export const SHOW_CAPABILITY_ROSTER_CHILD: CommanderConsoleChildDefinition<ShowCapabilityRosterInput, ShowCapabilityRosterOutput> = {
  childCapabilityId: "show-capability-roster",
  inputSchema: ShowCapabilityRosterInputSchema,
  outputSchema: ShowCapabilityRosterOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-capability-roster", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-capability-roster", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.capabilityHealthReadModel.listCapabilityRoster();
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `capability-roster:${output.length}`, evidenceRefs: output.map((entry) => entry.abilityGroupId), dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};