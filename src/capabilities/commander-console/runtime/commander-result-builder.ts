import { CommanderConsoleResultSchema } from "../schema.js";
import type { CommanderConsoleChildAbilityId } from "../contract.js";
import type { CommanderRuntimeProof } from "../shared/commander-proof.js";
import type { CommanderConsoleResult, CommanderConsoleStatus } from "../shared/commander-result.js";

export function buildCommanderConsoleResult<TOutput>(input: {
  childCapabilityId: CommanderConsoleChildAbilityId;
  status: CommanderConsoleStatus;
  output: TOutput | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  runtimeProof: CommanderRuntimeProof;
}): CommanderConsoleResult<TOutput> {
  return CommanderConsoleResultSchema.parse({
    abilityGroupId: "commander-console",
    childCapabilityId: input.childCapabilityId,
    status: input.status,
    output: input.output,
    failureReason: input.failureReason,
    reviewRequiredReason: input.reviewRequiredReason,
    runtimeProof: input.runtimeProof,
  }) as CommanderConsoleResult<TOutput>;
}