import { CommanderCommandReceiptSchema, CommanderConsoleResultSchema } from "../schema.js";
import type { CommanderDispatchChildId } from "../contract.js";
import type { CommanderRuntimeProof } from "../shared/commander-proof.js";
import type { CommanderConsoleResult, CommanderConsoleStatus } from "../shared/commander-result.js";
import type { CommanderCommandReceiptView } from "../shared/commander-view-types.js";

export function buildCommanderCommandReceipt(input: CommanderCommandReceiptView): CommanderCommandReceiptView {
  return CommanderCommandReceiptSchema.parse(input);
}

export function buildCommanderConsoleResult<TOutput>(input: {
  childCapabilityId: CommanderDispatchChildId;
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