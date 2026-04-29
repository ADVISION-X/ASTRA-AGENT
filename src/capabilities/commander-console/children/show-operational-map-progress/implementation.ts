import type { CommanderConsoleChildDefinition } from "../../runtime/commander-console-executor.js";
import { gateCommanderRead } from "../../runtime/commander-read-gate.js";
import type { ShowOperationalMapProgressInput, ShowOperationalMapProgressOutput } from "./contract.js";
import { ShowOperationalMapProgressInputSchema, ShowOperationalMapProgressOutputSchema } from "./schema.js";

export const SHOW_OPERATIONAL_MAP_PROGRESS_CHILD: CommanderConsoleChildDefinition<ShowOperationalMapProgressInput, ShowOperationalMapProgressOutput> = {
  childCapabilityId: "show-operational-map-progress",
  inputSchema: ShowOperationalMapProgressInputSchema,
  outputSchema: ShowOperationalMapProgressOutputSchema,
  async execute(input, context) {
    const gated = gateCommanderRead({ childCapabilityId: "show-operational-map-progress", operatorRef: input.operatorRef, readInput: input.input });
    if (!gated.ok) {
      return { status: "failed", output: null, failureReason: gated.reason, reviewRequiredReason: null, inputRef: "show-operational-map-progress", outputRef: null, evidenceRefs: [], dataQualityFlags: ["read_gate_blocked"], boundaryDecision: "read-port-only" };
    }

    const output = await context.missionReadModel.readMission();
    return { status: "success", output, failureReason: null, reviewRequiredReason: null, inputRef: gated.inputRef, outputRef: `mission-progress:${output.missionId ?? "none"}`, evidenceRefs: output.missionId ? [output.missionId] : [], dataQualityFlags: [], boundaryDecision: "read-port-only" };
  },
};